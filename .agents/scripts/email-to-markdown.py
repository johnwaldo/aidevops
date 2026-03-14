#!/usr/bin/env python3
"""
email-to-markdown.py - Convert .eml/.msg files to markdown with attachment extraction
Part of aidevops framework: https://aidevops.sh

Usage:
  Single file:  email-to-markdown.py <input-file> [--output <file>] [--attachments-dir <dir>]
                [--summary-mode auto|heuristic|llm|off]
  Batch mode:   email-to-markdown.py <directory> --batch [--threads-index]

Output format: YAML frontmatter with visible headers (from, to, cc, bcc, date_sent,
date_received, subject, size, message_id, in_reply_to, attachment_count, attachments),
thread reconstruction fields (thread_id, thread_position, thread_length),
markdown.new convention fields (title, description), and tokens_estimate for LLM context.

Summary generation (t1044.7): The description field contains a 1-2 sentence summary.
Short emails (<=100 words) use sentence extraction heuristic. Long emails use LLM
summarisation via Ollama (local) or Anthropic API (cloud fallback).

Thread reconstruction:
- Parses message_id and in_reply_to headers to build conversation threads
- thread_id: message-id of the root message (first in thread)
- thread_position: 1-based position in thread (1 = root)
- thread_length: total number of messages in thread
- --threads-index: generates JSON index files per thread in threads/ directory
"""

import sys
import os
import email
import email.policy
from email import message_from_binary_file
from email.utils import parsedate_to_datetime
import hashlib
import json
import html2text
import argparse
from pathlib import Path
import mimetypes
import re
from typing import Dict, List, Optional, Tuple, NamedTuple
from collections import defaultdict
import subprocess
import urllib.request
import urllib.error

# Word count threshold: emails with <= this many words use heuristic summary
SUMMARY_WORD_THRESHOLD = 100

# Ollama API endpoint (local LLM)
OLLAMA_API_URL = os.environ.get('OLLAMA_API_URL', 'http://localhost:11434/api/generate')

# Ollama model for summarisation
OLLAMA_MODEL = os.environ.get('OLLAMA_MODEL', 'llama3.2')

# Anthropic API endpoint (cloud fallback)
ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

# Anthropic model for summarisation (cheapest tier)
ANTHROPIC_MODEL = 'claude-haiku-4-20250414'


class ConvertOptions(NamedTuple):
    """Internal options bundle for email_to_markdown pipeline stages."""
    extract_entities: bool = False
    entity_method: str = 'auto'
    summary_mode: str = 'auto'
    thread_map: Optional[Dict] = None
    dedup_registry: Optional[Dict] = None
    no_normalise: bool = False


def parse_eml(file_path):
    """Parse .eml file using Python's email library."""
    with open(file_path, 'rb') as f:
        msg = message_from_binary_file(f, policy=email.policy.default)
    return msg


def parse_msg(file_path):
    """Parse .msg file using extract_msg library."""
    try:
        import extract_msg
    except ImportError:
        print("ERROR: extract_msg library required for .msg files", file=sys.stderr)
        print("Install: pip install extract-msg", file=sys.stderr)
        sys.exit(1)
    
    msg = extract_msg.Message(file_path)
    return msg


def _extract_mime_parts(msg):
    """Extract text/plain and text/html parts from an email.message.Message.

    Returns (body_text, body_html) taking the first occurrence of each type.
    """
    body_text = ""
    body_html = ""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            if content_type == 'text/plain' and not body_text:
                body_text = part.get_content()
            elif content_type == 'text/html' and not body_html:
                body_html = part.get_content()
    else:
        content_type = msg.get_content_type()
        if content_type == 'text/plain':
            body_text = msg.get_content()
        elif content_type == 'text/html':
            body_html = msg.get_content()
    return body_text, body_html


def _html_to_markdown(html_body):
    """Convert HTML email body to markdown text."""
    h = html2text.HTML2Text()
    h.ignore_links = False
    h.ignore_images = False
    h.ignore_emphasis = False
    h.body_width = 0  # Don't wrap lines
    return h.handle(html_body)


def get_email_body(msg, prefer_html=True):
    """Extract email body, preferring HTML if available."""
    if hasattr(msg, 'body'):  # extract_msg Message object
        body_text = msg.body or ""
        body_html = msg.htmlBody or ""
    else:  # email.message.Message object
        body_text, body_html = _extract_mime_parts(msg)

    if body_html and prefer_html:
        return _html_to_markdown(body_html)

    return body_text


def compute_content_hash(data):
    """Compute SHA-256 hash of binary data.

    Returns the hex digest string for use as a content-addressable key.
    """
    return hashlib.sha256(data).hexdigest()


def load_dedup_registry(registry_path):
    """Load the deduplication registry from a JSON file.

    The registry maps content_hash -> first occurrence path, enabling
    symlink-based deduplication across batch email imports.
    Returns an empty dict if the file doesn't exist.
    """
    if registry_path and os.path.isfile(registry_path):
        with open(registry_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_dedup_registry(registry, registry_path):
    """Persist the deduplication registry to a JSON file."""
    if registry_path:
        os.makedirs(os.path.dirname(registry_path) or '.', exist_ok=True)
        with open(registry_path, 'w', encoding='utf-8') as f:
            json.dump(registry, f, indent=2)


def _save_attachment(filepath, data, content_hash, dedup_registry):
    """Save an attachment, deduplicating via symlink if hash already seen.

    Returns a dict with 'deduplicated_from' set when a duplicate is detected.
    The original file is symlinked rather than copied to save disk space.
    """
    dedup_info = {}

    if dedup_registry is not None and content_hash in dedup_registry:
        # Duplicate detected — create symlink to first occurrence
        original_path = dedup_registry[content_hash]
        if os.path.exists(original_path):
            # Use relative symlink for portability
            try:
                rel_target = os.path.relpath(original_path, os.path.dirname(str(filepath)))
                os.symlink(rel_target, str(filepath))
            except OSError:
                # Fallback: absolute symlink if relative fails
                os.symlink(original_path, str(filepath))
            dedup_info['deduplicated_from'] = original_path
        else:
            # Original no longer exists — write normally and become new canonical
            with open(filepath, 'wb') as f:
                f.write(data)
            dedup_registry[content_hash] = str(filepath)
    else:
        # First occurrence — write file and register
        with open(filepath, 'wb') as f:
            f.write(data)
        if dedup_registry is not None:
            dedup_registry[content_hash] = str(filepath)

    return dedup_info


def _process_one_attachment(filename, data, output_path, dedup_registry):
    """Save a single attachment and return its metadata dict."""
    filepath = output_path / filename
    content_hash = compute_content_hash(data)
    dedup_info = _save_attachment(filepath, data, content_hash, dedup_registry)
    att_meta = {
        'filename': filename,
        'path': str(filepath),
        'size': len(data),
        'content_hash': content_hash,
    }
    att_meta.update(dedup_info)
    return att_meta


def _iter_msg_attachments(msg):
    """Yield (filename, data) pairs from an extract_msg Message object."""
    for attachment in msg.attachments:
        filename = attachment.longFilename or attachment.shortFilename or "attachment"
        yield filename, attachment.data


def _iter_eml_attachments(msg):
    """Yield (filename, data) pairs from an email.message.Message object."""
    for part in msg.walk():
        if part.get_content_maintype() == 'multipart':
            continue
        if part.get('Content-Disposition') is None:
            continue
        filename = part.get_filename()
        if filename:
            yield filename, part.get_payload(decode=True)


def extract_attachments(msg, output_dir, dedup_registry=None):
    """Extract attachments from email message with content-hash deduplication.

    Each attachment gets a SHA-256 content_hash. When dedup_registry is provided,
    duplicate attachments are symlinked to the first occurrence instead of being
    written again, and a 'deduplicated_from' field is added to their metadata.
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    if hasattr(msg, 'attachments'):  # extract_msg Message object
        att_iter = _iter_msg_attachments(msg)
    else:  # email.message.Message object
        att_iter = _iter_eml_attachments(msg)

    return [
        _process_one_attachment(filename, data, output_path, dedup_registry)
        for filename, data in att_iter
    ]


def format_size(size_bytes):
    """Format file size in human-readable format."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"


def estimate_tokens(text):
    """Estimate token count using word-based heuristic (words * 1.3).

    This approximates GPT/Claude tokenization without requiring tiktoken.
    The 1.3 multiplier accounts for subword tokenization of punctuation,
    numbers, and multi-syllable words.
    """
    if not text:
        return 0
    words = len(text.split())
    return int(words * 1.3)


def yaml_escape(value):
    """Escape a string value for safe YAML output.

    Wraps in double quotes if the value contains characters that could
    break YAML parsing (colons, quotes, newlines, leading special chars).
    """
    if value is None:
        return '""'
    value = str(value)
    if not value:
        return '""'
    # Quote if contains YAML-special characters or starts with special chars
    needs_quoting = any(c in value for c in [':', '#', '{', '}', '[', ']', ',', '&', '*', '?', '|', '-', '<', '>', '=', '!', '%', '@', '`', '\n', '\r', '"', "'"])
    needs_quoting = needs_quoting or value.startswith((' ', '\t'))
    if needs_quoting:
        # Escape backslashes and double quotes for YAML double-quoted strings
        value = value.replace('\\', '\\\\').replace('"', '\\"')
        # Replace newlines with spaces
        value = value.replace('\n', ' ').replace('\r', '')
        return f'"{value}"'
    return value


def _is_forwarded_header(stripped):
    """Check if a line is a forwarded message header delimiter."""
    if re.match(r'^-{3,}\s*(Forwarded|Original)\s+(message|Message)\s*-{3,}$', stripped):
        return True
    if re.match(r'^Begin forwarded message\s*:', stripped, re.IGNORECASE):
        return True
    return False


_HEADER_FIELD_RE = re.compile(
    r'^(From|Date|Subject|To|Cc|Sent|Reply-To)\s*:')

_ATTRIBUTION_RE = re.compile(r'^On\s+.+wrote\s*:\s*$')


def _is_signature_delimiter(stripped):
    """Check if a line is an email signature delimiter.

    A line that strips to '--' covers both the RFC 3676 delimiter ('-- ')
    and the common bare '--'.
    """
    return stripped == '--'


def _has_attribution_before(lines, index):
    """Check if the previous line has an 'On ... wrote:' attribution pattern.

    Handles re-quoted emails where the previous line may itself be
    quote-marked (e.g., '> On date, user wrote:') by stripping leading
    '>' characters and whitespace before matching.
    """
    if index <= 0:
        return False
    prev = re.sub(r'^[>\s]+', '', lines[index - 1])
    if _ATTRIBUTION_RE.match(prev):
        return True
    return False


class _SectionState:
    """Mutable state tracker for email section normalisation."""
    __slots__ = ('in_quote_block', 'in_signature', 'in_forwarded')

    def __init__(self):
        self.in_quote_block = False
        self.in_signature = False
        self.in_forwarded = False


def _handle_forwarded_header(result, state):
    """Emit a forwarded-message heading and update state."""
    if state.in_quote_block:
        result.append('')
        state.in_quote_block = False
    state.in_signature = False
    state.in_forwarded = True
    result.append('')
    result.append('## Forwarded Message')
    result.append('')


def _handle_forwarded_body(stripped, result, state):
    """Process a line while inside a forwarded header block.

    Returns True if the line was consumed, False to fall through.
    """
    if state.in_forwarded and _HEADER_FIELD_RE.match(stripped):
        result.append(f'**{stripped}**')
        return True
    if state.in_forwarded and stripped and not _HEADER_FIELD_RE.match(stripped):
        state.in_forwarded = False
        result.append('')
    return False


def _handle_signature(stripped, line, result, state):
    """Process signature-related lines.

    Returns True if the line was consumed, False to fall through.
    """
    if _is_signature_delimiter(stripped):
        if state.in_quote_block:
            result.append('')
            state.in_quote_block = False
        state.in_signature = True
        result.append('')
        result.append('## Signature')
        result.append('')
        return True
    if not state.in_signature:
        return False
    # Inside signature block — check for exit conditions
    if stripped.startswith('>') or re.match(
            r'^-{3,}\s*(Forwarded|Original)', stripped):
        state.in_signature = False
        return False
    result.append(line)
    return True


def _start_quote_block(lines, i, result):
    """Emit a quoted-reply heading if no attribution line precedes this quote."""
    if not _has_attribution_before(lines, i):
        result.append('')
        result.append('## Quoted Reply')
        result.append('')


def _handle_quote_exit(stripped, result):
    """Handle transition out of a quote block on a non-quoted line.

    Returns True if the line was consumed as an attribution, False otherwise.
    """
    if _ATTRIBUTION_RE.match(stripped):
        result.append('')
        result.append('## Quoted Reply')
        result.append('')
        result.append(f'*{stripped}*')
        return True
    return False


def _handle_quoted_line(line, lines, i, result, state):
    """Handle lines that are part of or transitioning from a quote block.

    Returns True if the line was consumed, False to fall through.
    """
    stripped = line.strip()
    if stripped.startswith('>'):
        if not state.in_quote_block:
            state.in_quote_block = True
            _start_quote_block(lines, i, result)
        result.append(line)
        return True

    if state.in_quote_block:
        state.in_quote_block = False
        return _handle_quote_exit(stripped, result)

    return False


def _process_section_line(line, lines, i, result, state):
    """Dispatch a single line through the section-detection pipeline.

    Returns True if the line was consumed by a handler, False to append as-is.
    """
    stripped = line.strip()

    if _is_forwarded_header(stripped):
        _handle_forwarded_header(result, state)
        return True

    consumed = (_handle_forwarded_body(stripped, result, state)
                or _handle_signature(stripped, line, result, state)
                or _handle_quoted_line(line, lines, i, result, state))
    return consumed


def normalise_email_sections(body):
    """Detect and structure email-specific sections in the body text.

    Handles:
    - Quoted replies (lines starting with >)
    - Signature blocks (lines after --)
    - Forwarded message headers (---------- Forwarded message ----------)
    """
    lines = body.splitlines()
    result = []
    state = _SectionState()

    for i, line in enumerate(lines):
        if not _process_section_line(line, lines, i, result, state):
            result.append(line)

    return '\n'.join(result)


def build_thread_map(emails_dir: Path) -> Dict[str, Dict]:
    """Build a map of all emails by message-id for thread reconstruction.
    
    Returns a dict mapping message_id -> {file_path, in_reply_to, date_sent, subject}
    """
    thread_map = {}
    
    # Find all .eml and .msg files
    for ext in ['.eml', '.msg']:
        for email_file in emails_dir.glob(f'**/*{ext}'):
            try:
                # Parse just the headers we need
                if ext == '.eml':
                    msg = parse_eml(email_file)
                else:
                    msg = parse_msg(email_file)
                
                message_id = extract_header_safe(msg, 'Message-ID')
                in_reply_to = extract_header_safe(msg, 'In-Reply-To')
                date_sent_raw = extract_header_safe(msg, 'Date')
                subject = extract_header_safe(msg, 'Subject', 'No Subject')
                
                if message_id:
                    thread_map[message_id] = {
                        'file_path': str(email_file),
                        'in_reply_to': in_reply_to,
                        'date_sent': parse_date_safe(date_sent_raw),
                        'subject': subject
                    }
            except Exception as e:
                print(f"Warning: Failed to parse {email_file}: {e}", file=sys.stderr)
                continue
    
    return thread_map


def _walk_ancestor_chain(message_id: str, thread_map: Dict[str, Dict]) -> List[str]:
    """Walk backwards from message_id to the thread root via in_reply_to.

    Returns the chain of message IDs from root to message_id, inclusive.
    """
    current_id = message_id
    chain = [current_id]
    visited = {current_id}

    while True:
        current_info = thread_map.get(current_id)
        if not current_info:
            break
        in_reply_to = current_info.get('in_reply_to', '')
        if not in_reply_to or in_reply_to not in thread_map:
            break
        if in_reply_to in visited:
            break
        chain.insert(0, in_reply_to)
        visited.add(in_reply_to)
        current_id = in_reply_to

    return chain


def _count_descendants(msg_id: str, thread_map: Dict[str, Dict],
                       visited_desc: set) -> int:
    """Recursively count all descendants of msg_id in the thread map."""
    if msg_id in visited_desc:
        return 0
    visited_desc.add(msg_id)

    count = 1
    for mid, info in thread_map.items():
        if info.get('in_reply_to') == msg_id and mid not in visited_desc:
            count += _count_descendants(mid, thread_map, visited_desc)
    return count


def reconstruct_thread(message_id: str, thread_map: Dict[str, Dict]) -> Tuple[str, int, int]:
    """Reconstruct thread information for a given message.
    
    Returns: (thread_id, thread_position, thread_length)
    - thread_id: message-id of the root message (first in thread)
    - thread_position: 1-based position in thread (1 = root)
    - thread_length: total number of messages in thread
    """
    if not message_id or message_id not in thread_map:
        return ('', 0, 0)

    chain = _walk_ancestor_chain(message_id, thread_map)
    thread_id = chain[0]
    thread_position = chain.index(message_id) + 1
    thread_length = _count_descendants(thread_id, thread_map, set())

    return (thread_id, thread_position, thread_length)


def generate_thread_index(thread_map: Dict[str, Dict], output_dir: Path) -> Dict[str, List[Dict]]:
    """Generate thread index files grouped by thread_id.
    
    Returns a dict mapping thread_id -> list of email metadata in chronological order.
    Writes one index file per thread to output_dir/threads/
    """
    # Group emails by thread
    threads = defaultdict(list)
    
    for message_id, info in thread_map.items():
        thread_id, position, length = reconstruct_thread(message_id, thread_map)
        if thread_id:
            threads[thread_id].append({
                'message_id': message_id,
                'file_path': info['file_path'],
                'subject': info['subject'],
                'date_sent': info['date_sent'],
                'thread_position': position,
                'thread_length': length
            })
    
    # Sort each thread by date
    for thread_id in threads:
        threads[thread_id].sort(key=lambda x: x['date_sent'] or '')
    
    # Write thread index files
    threads_dir = output_dir / 'threads'
    threads_dir.mkdir(parents=True, exist_ok=True)
    
    for thread_id, emails in threads.items():
        # Sanitize thread_id for filename (remove angle brackets, slashes)
        safe_thread_id = re.sub(r'[<>:/\\|?*]', '_', thread_id)
        index_file = threads_dir / f'{safe_thread_id}.json'
        
        with open(index_file, 'w', encoding='utf-8') as f:
            json.dump({
                'thread_id': thread_id,
                'thread_length': len(emails),
                'emails': emails
            }, f, indent=2, ensure_ascii=False)
    
    return dict(threads)


def strip_markdown(text):
    """Strip markdown formatting from text, returning plain text.

    Removes links, images, emphasis, headings, and collapses whitespace.
    """
    if not text:
        return ""
    text = re.sub(r'!\[([^\]]*)\]\([^)]*\)', r'\1', text)  # images
    text = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', text)    # links
    text = re.sub(r'[*_]{1,3}', '', text)                    # emphasis
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)  # headings
    text = re.sub(r'\n+', ' ', text)                          # newlines
    text = re.sub(r'\s+', ' ', text).strip()                  # whitespace
    return text


def make_description(body, max_len=160):
    """Extract first max_len chars of body as description (markdown.new convention).

    Strips markdown formatting, collapses whitespace, and truncates with
    ellipsis if the text exceeds max_len. Used as fallback when summary
    generation is disabled.
    """
    text = strip_markdown(body)
    if not text:
        return ""
    if len(text) > max_len:
        # Truncate at word boundary
        text = text[:max_len].rsplit(' ', 1)[0] + '...'
    return text


def extract_sentences(text, max_sentences=2):
    """Extract the first N complete sentences from plain text.

    Uses sentence-boundary detection (period/exclamation/question followed
    by space or end-of-string). Returns up to max_sentences sentences,
    capped at 200 characters for frontmatter readability.
    """
    if not text:
        return ""
    # Split on sentence boundaries: .!? followed by space or end
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    # Filter out very short fragments (< 5 chars) that aren't real sentences
    sentences = [s for s in sentences if len(s.strip()) >= 5]
    if not sentences:
        # No sentence boundaries found — truncate at word boundary
        if len(text) > 200:
            return text[:200].rsplit(' ', 1)[0] + '...'
        return text
    result = ' '.join(sentences[:max_sentences])
    if len(result) > 200:
        result = result[:200].rsplit(' ', 1)[0] + '...'
    return result


def _get_anthropic_api_key():
    """Retrieve Anthropic API key from gopass, credentials file, or environment.

    Returns the key string or None if unavailable. Never prints the key.
    """
    # Try gopass first (encrypted)
    try:
        result = subprocess.run(
            ['gopass', 'show', '-o', 'aidevops/anthropic-api-key'],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    # Try credentials file
    creds_file = Path.home() / '.config' / 'aidevops' / 'credentials.sh'
    if creds_file.is_file():
        try:
            for line in creds_file.read_text().splitlines():
                if line.startswith('ANTHROPIC_API_KEY='):
                    key = line.split('=', 1)[1].strip().strip('"').strip("'")
                    if key:
                        return key
        except OSError:
            pass

    # Try environment variable
    return os.environ.get('ANTHROPIC_API_KEY')


def _summarise_with_ollama(plain_text, subject):
    """Summarise email body using local Ollama LLM.

    Returns summary string or None if Ollama is unavailable.
    """
    prompt = (
        "Summarise this email in 1-2 sentences. Be concise and factual. "
        "Return ONLY the summary, no preamble or explanation.\n\n"
        f"Subject: {subject}\n\n"
        f"Body:\n{plain_text[:3000]}"  # Cap input to avoid context overflow
    )
    payload = json.dumps({
        'model': OLLAMA_MODEL,
        'prompt': prompt,
        'stream': False,
        'options': {'temperature': 0.3, 'num_predict': 100}
    }).encode('utf-8')

    req = urllib.request.Request(
        OLLAMA_API_URL,
        data=payload,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            summary = data.get('response', '').strip()
            if summary:
                # Clean up: remove quotes, leading "Summary:", etc.
                summary = re.sub(r'^(Summary:\s*|"|\')', '', summary)
                summary = summary.rstrip('"\'')
                return summary
    except (urllib.error.URLError, urllib.error.HTTPError, OSError,
            json.JSONDecodeError, KeyError):
        pass
    return None


def _summarise_with_anthropic(plain_text, subject):
    """Summarise email body using Anthropic API (cloud fallback).

    Returns summary string or None if API is unavailable.
    """
    api_key = _get_anthropic_api_key()
    if not api_key:
        return None

    prompt = (
        "Summarise this email in 1-2 sentences. Be concise and factual. "
        "Return ONLY the summary, no preamble or explanation.\n\n"
        f"Subject: {subject}\n\n"
        f"Body:\n{plain_text[:3000]}"
    )
    payload = json.dumps({
        'model': ANTHROPIC_MODEL,
        'max_tokens': 150,
        'messages': [{'role': 'user', 'content': prompt}]
    }).encode('utf-8')

    req = urllib.request.Request(
        ANTHROPIC_API_URL,
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'x-api-key': api_key,
            'anthropic-version': '2023-06-01'
        },
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            content = data.get('content', [])
            if content and isinstance(content, list):
                summary = content[0].get('text', '').strip()
                if summary:
                    return summary
    except (urllib.error.URLError, urllib.error.HTTPError, OSError,
            json.JSONDecodeError, KeyError, IndexError):
        pass
    return None


def _try_llm_summary(plain_text, subject, warn_on_fail=False):
    """Attempt LLM summarisation via Ollama then Anthropic.

    Returns (summary, method) on success, or None if both fail.
    When warn_on_fail is True, prints a warning before returning None.
    """
    summary = _summarise_with_ollama(plain_text, subject)
    if summary:
        return summary, 'ollama'
    summary = _summarise_with_anthropic(plain_text, subject)
    if summary:
        return summary, 'anthropic'
    if warn_on_fail:
        print("WARNING: LLM unavailable, falling back to heuristic summary",
              file=sys.stderr)
    return None


def generate_summary(body, subject='', summary_mode='auto'):
    """Generate a 1-2 sentence summary for the email description field.

    Routing logic (summary_mode='auto'):
    - Empty body: returns empty string
    - Short emails (<=SUMMARY_WORD_THRESHOLD words): sentence extraction heuristic
    - Long emails (>SUMMARY_WORD_THRESHOLD words): LLM summarisation
      (Ollama local first, Anthropic API fallback, heuristic last resort)

    Args:
        body: Raw email body (may contain markdown formatting)
        subject: Email subject line (provides context for LLM)
        summary_mode: 'auto' (default), 'heuristic', 'llm', or 'off'

    Returns:
        Tuple of (summary_text, method_used) where method_used is one of:
        'heuristic', 'ollama', 'anthropic', 'truncated', or 'off'
    """
    if summary_mode == 'off':
        return make_description(body), 'off'

    plain_text = strip_markdown(body)
    if not plain_text:
        return '', 'heuristic'

    if summary_mode == 'heuristic':
        return extract_sentences(plain_text), 'heuristic'

    # LLM-capable modes: 'llm' (forced) or 'auto' (long emails only)
    use_llm = summary_mode == 'llm' or len(plain_text.split()) > SUMMARY_WORD_THRESHOLD

    if use_llm:
        result = _try_llm_summary(plain_text, subject,
                                  warn_on_fail=(summary_mode == 'llm'))
        if result:
            return result

    return extract_sentences(plain_text), 'heuristic'


def get_file_size(file_path):
    """Get file size in bytes."""
    try:
        return os.path.getsize(file_path)
    except OSError:
        return 0


def extract_header_safe(msg, header, default=''):
    """Safely extract an email header, handling both eml and msg formats."""
    if hasattr(msg, 'sender'):  # extract_msg object
        header_map = {
            'From': getattr(msg, 'sender', default),
            'To': getattr(msg, 'to', default),
            'Cc': getattr(msg, 'cc', default),
            'Bcc': getattr(msg, 'bcc', default),
            'Subject': getattr(msg, 'subject', default),
            'Date': getattr(msg, 'date', default),
            'Message-ID': getattr(msg, 'messageId', default),
            'In-Reply-To': getattr(msg, 'inReplyTo', default),
        }
        return header_map.get(header, default) or default
    else:  # email.message.EmailMessage
        return msg.get(header, default) or default


def parse_date_safe(date_str):
    """Parse a date string to ISO format, returning original on failure."""
    if not date_str or date_str == 'Unknown':
        return ''
    try:
        dt = parsedate_to_datetime(date_str)
        return dt.strftime('%Y-%m-%dT%H:%M:%S%z')
    except Exception:
        return str(date_str)


def _format_attachment_yaml(att):
    """Format a single attachment dict as indented YAML list-item lines."""
    lines = [f'  - filename: {yaml_escape(att["filename"])}']
    lines.append(f'    size: {yaml_escape(att["size"])}')
    if 'content_hash' in att:
        lines.append(f'    content_hash: {att["content_hash"]}')
    if 'deduplicated_from' in att:
        lines.append(f'    deduplicated_from: {yaml_escape(att["deduplicated_from"])}')
    return lines


def _format_attachments_yaml(key, attachments):
    """Format the attachments list as YAML lines."""
    if not attachments:
        return [f'{key}: []']
    lines = [f'{key}:']
    for att in attachments:
        lines.extend(_format_attachment_yaml(att))
    return lines


def _format_entities_yaml(key, entities):
    """Format the entities dict-of-lists as YAML lines."""
    if not entities:
        return [f'{key}: {{}}']
    lines = [f'{key}:']
    for entity_type, entity_list in entities.items():
        if not entity_list:
            continue
        lines.append(f'  {entity_type}:')
        for entity in entity_list:
            lines.append(f'    - {yaml_escape(entity)}')
    return lines


def build_frontmatter(metadata):
    """Build YAML frontmatter string from metadata dict.

    Handles scalar values, lists of dicts (attachments with content_hash
    and optional deduplicated_from), nested dicts of lists (entities),
    and proper YAML escaping for all string values.
    """
    lines = ['---']
    for key, value in metadata.items():
        if key == 'attachments' and isinstance(value, list):
            lines.extend(_format_attachments_yaml(key, value))
        elif key == 'entities' and isinstance(value, dict):
            lines.extend(_format_entities_yaml(key, value))
        elif isinstance(value, (int, float)):
            lines.append(f'{key}: {value}')
        else:
            lines.append(f'{key}: {yaml_escape(value)}')
    lines.append('---')
    return '\n'.join(lines)


def run_entity_extraction(body, method='auto'):
    """Run entity extraction on email body text.

    Imports entity-extraction.py from the same directory and runs extraction.
    Returns dict of entities grouped by type, or empty dict on failure.
    """
    if not body or not body.strip():
        return {}

    try:
        script_dir = Path(__file__).parent
        # Import entity-extraction module dynamically (filename has hyphens)
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "entity_extraction",
            script_dir / "entity-extraction.py"
        )
        if spec is None or spec.loader is None:
            return {}
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod.extract_entities(body, method=method)
    except Exception as e:
        print(f"WARNING: Entity extraction failed: {e}", file=sys.stderr)
        return {}


def _parse_email_file(input_path):
    """Parse an email file based on its extension. Exits on unsupported types."""
    ext = input_path.suffix.lower()
    if ext == '.eml':
        return parse_eml(input_path)
    if ext == '.msg':
        return parse_msg(input_path)
    print(f"ERROR: Unsupported file type: {ext}", file=sys.stderr)
    print("Supported: .eml, .msg", file=sys.stderr)
    sys.exit(1)


def _extract_headers(msg):
    """Extract all visible email headers into a flat dict."""
    return {
        'from': extract_header_safe(msg, 'From', 'Unknown'),
        'to': extract_header_safe(msg, 'To', 'Unknown'),
        'cc': extract_header_safe(msg, 'Cc'),
        'bcc': extract_header_safe(msg, 'Bcc'),
        'subject': extract_header_safe(msg, 'Subject', 'No Subject'),
        'message_id': extract_header_safe(msg, 'Message-ID'),
        'in_reply_to': extract_header_safe(msg, 'In-Reply-To'),
        'date_sent_raw': extract_header_safe(msg, 'Date'),
        'date_received_raw': extract_header_safe(msg, 'Received'),
    }


def _parse_received_date(date_received_raw):
    """Extract the date portion from a Received header value."""
    if date_received_raw and ';' in date_received_raw:
        return date_received_raw.rsplit(';', 1)[-1].strip()
    return date_received_raw


def _build_attachment_meta(attachments):
    """Build frontmatter-ready attachment metadata from raw attachment list."""
    meta_list = []
    for att in attachments:
        meta = {
            'filename': att['filename'],
            'size': format_size(att['size']),
            'content_hash': att['content_hash'],
        }
        if 'deduplicated_from' in att:
            meta['deduplicated_from'] = att['deduplicated_from']
        meta_list.append(meta)
    return meta_list


class _PipelineData(NamedTuple):
    """Intermediate results from the email conversion pipeline."""
    headers: Dict
    date_sent: str
    date_received: str
    file_size: int
    body: str
    description: str
    summary_method_used: str
    attachment_meta: List[Dict]
    attachments: List[Dict]
    tokens_estimate: int


def _add_header_fields(metadata, headers, date_sent, date_received):
    """Populate email header fields in the metadata dict."""
    metadata['from'] = headers['from']
    metadata['to'] = headers['to']
    if headers['cc']:
        metadata['cc'] = headers['cc']
    if headers['bcc']:
        metadata['bcc'] = headers['bcc']
    metadata['date_sent'] = date_sent
    if date_received:
        metadata['date_received'] = date_received
    metadata['subject'] = headers['subject']
    metadata['size'] = format_size(headers.get('_file_size', 0))
    metadata['message_id'] = headers['message_id']
    if headers['in_reply_to']:
        metadata['in_reply_to'] = headers['in_reply_to']


def _add_thread_fields(metadata, message_id, thread_map):
    """Populate thread reconstruction fields in the metadata dict."""
    if not (thread_map and message_id):
        return
    thread_id, thread_position, thread_length = reconstruct_thread(
        message_id, thread_map)
    if thread_id:
        metadata['thread_id'] = thread_id
        metadata['thread_position'] = thread_position
        metadata['thread_length'] = thread_length


def _build_metadata(pipe, opts):
    """Assemble the ordered metadata dict for YAML frontmatter."""
    from collections import OrderedDict
    metadata = OrderedDict()
    metadata['title'] = pipe.headers['subject']
    metadata['description'] = pipe.description
    metadata['summary_method'] = pipe.summary_method_used

    # Store file_size in headers temporarily for _add_header_fields
    pipe.headers['_file_size'] = pipe.file_size
    _add_header_fields(metadata, pipe.headers, pipe.date_sent,
                       pipe.date_received)

    _add_thread_fields(metadata, pipe.headers['message_id'],
                       opts.thread_map)

    metadata['attachment_count'] = len(pipe.attachments)
    metadata['attachments'] = pipe.attachment_meta
    metadata['tokens_estimate'] = pipe.tokens_estimate

    if opts.extract_entities:
        entities = run_entity_extraction(pipe.body, method=opts.entity_method)
        if entities:
            metadata['entities'] = entities

    return metadata


def email_to_markdown(input_file, output_file=None, attachments_dir=None,
                      extract_entities=False, entity_method='auto',
                      summary_mode='auto', thread_map=None,
                      dedup_registry=None, no_normalise=False):
    """Convert email file to markdown with YAML frontmatter and attachment extraction.

    Output includes:
    - YAML frontmatter with visible email headers (from, to, cc, bcc, date_sent,
      date_received, subject, size, message_id, in_reply_to, attachment_count,
      attachments list with content_hash per attachment)
    - Thread reconstruction fields (thread_id, thread_position, thread_length)
    - markdown.new convention fields (title = subject, description = auto-summary)
    - summary_method field indicating how the description was generated
    - tokens_estimate for LLM context budgeting
    - entities (when extract_entities=True): people, organisations, properties,
      locations, dates extracted via spaCy/Ollama/regex
    - Body as markdown content

    Args:
        input_file: Path to .eml or .msg file
        output_file: Optional output path for markdown file
        attachments_dir: Optional directory for extracted attachments
        summary_mode: Summary generation mode ('auto', 'heuristic', 'llm', 'off')
        thread_map: Optional pre-built thread map for thread reconstruction.
                   If None, thread fields will be empty.
        dedup_registry: Optional dict mapping content_hash -> first path.
                       When provided, duplicate attachments are symlinked instead
                       of written, and their frontmatter includes a
                       deduplicated_from field pointing to the canonical copy.
    """
    # Pack options internally (public signature unchanged)
    opts = ConvertOptions(
        extract_entities=extract_entities,
        entity_method=entity_method,
        summary_mode=summary_mode,
        thread_map=thread_map,
        dedup_registry=dedup_registry,
        no_normalise=no_normalise,
    )

    input_path = Path(input_file)
    msg = _parse_email_file(input_path)

    if output_file is None:
        output_file = input_path.with_suffix('.md')
    if attachments_dir is None:
        attachments_dir = input_path.parent / f"{input_path.stem}_attachments"

    # Stage 1: Extract headers and dates
    headers = _extract_headers(msg)
    date_sent = parse_date_safe(headers['date_sent_raw'])
    date_received = parse_date_safe(
        _parse_received_date(headers['date_received_raw']))

    # Stage 2: Extract body and normalise
    body = get_email_body(msg)
    if not opts.no_normalise:
        body = normalise_email_sections(body)

    # Stage 3: Attachments
    attachments = extract_attachments(msg, attachments_dir, opts.dedup_registry)
    attachment_meta = _build_attachment_meta(attachments)

    # Stage 4: Summary and tokens
    description, summary_method_used = generate_summary(
        body, headers['subject'], opts.summary_mode)
    tokens_estimate = estimate_tokens(body)

    # Stage 5: Assemble metadata and write
    pipe = _PipelineData(
        headers=headers,
        date_sent=date_sent,
        date_received=date_received,
        file_size=get_file_size(input_file),
        body=body,
        description=description,
        summary_method_used=summary_method_used,
        attachment_meta=attachment_meta,
        attachments=attachments,
        tokens_estimate=tokens_estimate,
    )
    metadata = _build_metadata(pipe, opts)

    frontmatter = build_frontmatter(metadata)
    md_content = f"{frontmatter}\n\n{body}"

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(md_content)

    return {
        'markdown': str(output_file),
        'attachments': attachments,
        'attachments_dir': str(attachments_dir) if attachments else None
    }


def _build_arg_parser():
    """Build and return the CLI argument parser."""
    parser = argparse.ArgumentParser(
        description='Convert .eml/.msg email files to markdown with '
                    'attachment extraction and thread reconstruction'
    )
    parser.add_argument('input',
                        help='Input email file (.eml or .msg) or directory '
                             'for batch processing')
    parser.add_argument('--output', '-o',
                        help='Output markdown file (default: input.md)')
    parser.add_argument('--attachments-dir',
                        help='Directory for attachments '
                             '(default: input_attachments/)')
    parser.add_argument('--extract-entities', action='store_true',
                        help='Extract named entities (people, orgs, '
                             'locations, dates) into frontmatter')
    parser.add_argument('--entity-method',
                        choices=['auto', 'spacy', 'ollama', 'regex'],
                        default='auto',
                        help='Entity extraction method (default: auto)')
    parser.add_argument('--summary-mode',
                        choices=['auto', 'heuristic', 'llm', 'off'],
                        default='auto',
                        help='Summary generation mode: auto (default) '
                             'routes by word count, heuristic (sentence '
                             'extraction), llm (force LLM), '
                             'off (160-char truncation)')
    parser.add_argument('--batch', action='store_true',
                        help='Process all .eml/.msg files in input directory '
                             'with thread reconstruction')
    parser.add_argument('--threads-index', action='store_true',
                        help='Generate thread index files (requires --batch)')
    parser.add_argument('--dedup-registry',
                        help='Path to JSON dedup registry for cross-email '
                             'attachment deduplication')
    parser.add_argument('--no-normalise', '--no-normalize',
                        action='store_true',
                        help='Skip email section normalisation (quoted '
                             'replies, signatures, forwards)')
    return parser


def _run_batch(input_path, args, registry):
    """Process all emails in a directory with thread reconstruction."""
    if not input_path.is_dir():
        print("ERROR: --batch requires input to be a directory",
              file=sys.stderr)
        sys.exit(1)

    print("Building thread map...")
    thread_map = build_thread_map(input_path)
    print(f"Found {len(thread_map)} emails")

    processed = 0
    for _message_id, info in thread_map.items():
        email_file = Path(info['file_path'])
        try:
            result = email_to_markdown(
                email_file,
                output_file=email_file.with_suffix('.md'),
                extract_entities=args.extract_entities,
                entity_method=args.entity_method,
                summary_mode=args.summary_mode,
                thread_map=thread_map,
                dedup_registry=registry,
                no_normalise=args.no_normalise,
            )
            processed += 1
            print(f"Processed: {email_file.name} -> {result['markdown']}")
        except Exception as e:
            print(f"ERROR processing {email_file}: {e}", file=sys.stderr)

    print(f"\nProcessed {processed}/{len(thread_map)} emails")

    if args.threads_index:
        print("\nGenerating thread index files...")
        threads = generate_thread_index(thread_map, input_path)
        print(f"Created {len(threads)} thread index files "
              f"in {input_path}/threads/")


def _run_single(input_path, args, registry):
    """Process a single email file."""
    if not input_path.is_file():
        print(f"ERROR: Input file not found: {input_path}",
              file=sys.stderr)
        sys.exit(1)

    thread_map = None
    if input_path.parent.exists():
        try:
            thread_map = build_thread_map(input_path.parent)
            if thread_map:
                print(f"Found {len(thread_map)} emails in directory "
                      "for thread reconstruction")
        except Exception:
            pass  # Thread reconstruction is optional

    result = email_to_markdown(
        args.input, args.output, args.attachments_dir,
        extract_entities=args.extract_entities,
        entity_method=args.entity_method,
        summary_mode=args.summary_mode,
        thread_map=thread_map,
        dedup_registry=registry,
        no_normalise=args.no_normalise,
    )

    print(f"Created: {result['markdown']}")
    if not result['attachments']:
        return

    deduped = sum(1 for a in result['attachments']
                  if 'deduplicated_from' in a)
    print(f"Extracted {len(result['attachments'])} attachment(s) "
          f"to: {result['attachments_dir']}")
    if deduped:
        print(f"  ({deduped} deduplicated via symlink)")
    for att in result['attachments']:
        suffix = " [dedup]" if 'deduplicated_from' in att else ""
        print(f"  - {att['filename']} "
              f"({format_size(att['size'])}){suffix}")


def main():
    parser = _build_arg_parser()
    args = parser.parse_args()

    registry = None
    if args.dedup_registry:
        registry = load_dedup_registry(args.dedup_registry)

    input_path = Path(args.input)

    if args.batch or input_path.is_dir():
        _run_batch(input_path, args, registry)
    else:
        _run_single(input_path, args, registry)

    if args.dedup_registry and registry is not None:
        save_dedup_registry(registry, args.dedup_registry)


if __name__ == '__main__':
    main()
