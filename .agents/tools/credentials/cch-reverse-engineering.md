---
description: Reverse-engineer Claude CLI request signing and detect API protocol changes
mode: subagent
tools:
  read: true
  bash: true
  edit: true
  write: true
---

# CCH Reverse Engineering Agent

Extracts request signing constants from the Claude CLI binary/source and detects protocol changes. Run after every CLI update, on OAuth pool failures, or weekly via pulse.

## Quick Reference

```bash
cch-extract.sh --cache                                        # Extract + cache constants (run after every CLI update)
cch-extract.sh --verify                                       # Verify cache vs installed version
cch-traffic-monitor.sh capture --duration 60                  # Capture API traffic
cch-traffic-monitor.sh diff <baseline.json> <current.json>    # Diff two captures
cch-traffic-monitor.sh analyse                                # Full analysis pipeline
```

`cch-extract.sh` automates Phases 1–3. `cch-traffic-monitor.sh` automates Phase 4.

## Files

| File | Purpose |
|------|---------|
| `scripts/cch-extract.sh` | Extract constants from installed CLI |
| `scripts/cch-sign.py` | Compute billing header |
| `scripts/cch-traffic-monitor.sh` | Capture and diff API traffic |
| `~/.aidevops/cch-constants.json` | Cached constants (auto-generated) |

## Known Signing Protocol (as of v2.1.92)

### Version Suffix

```
cc_version = {version}.{suffix}
suffix = sha256(salt + picked_chars + version)[:3]
picked_chars = msg[4] + msg[7] + msg[20]  (or "0" if index > len)
```

- **Salt**: `59cf53e54c78` (12-char hex, in JS source)
- **Indices**: `[4, 7, 20]`
- **Hash**: SHA-256, first 3 hex characters

### Body Hash

| Client | Mechanism | Value |
|--------|-----------|-------|
| Node.js (v2.1.92) | Placeholder | `cch=00000` |
| Bun (v2.1.37) | xxHash64 in native fetch | `cch={hash & 0xFFFFF:05x}` |

Bun-era seed: `0x6E52736AC806831E`

### Required Headers

```
Authorization: Bearer {oauth_token}
anthropic-beta: claude-code-20250219,oauth-2025-04-20,...
anthropic-version: 2023-06-01
User-Agent: claude-cli/{version} (external, cli)
x-app: cli
```

### Required Body Structure

```json
{
  "system": [
    {"type": "text", "text": "x-anthropic-billing-header: cc_version=..."},
    {"type": "text", "text": "You are Claude Code, Anthropic's official CLI..."},
    {"type": "text", "text": "Your system prompt...", "cache_control": {"type": "ephemeral"}}
  ],
  "model": "claude-sonnet-4-6",
  "thinking": {"type": "adaptive"},
  "metadata": {"user_id": "..."},
  "messages": [...]
}
```

## Reverse Engineering Playbook

### Phase 1: Source Extraction

| Form | Detection | Extraction |
|------|-----------|------------|
| **Node.js npm** | `file $(which claude)` → "script text" | `readlink -f $(which claude)` → `cli.js` (readable). Key functions: `GG8()` billing header, `KA7()` version suffix (SHA-256), `rlK()` calls `KA7` |
| **Bun binary** | `file $(which claude)` → "Mach-O" / "ELF" | `strings /path/to/claude \| python3 -c "import sys; c=sys.stdin.read(); print(c[c.find('function'):])"` or `bun build --dump /path/to/claude` |

### Phase 2: Constant Identification

```bash
# Salt (12-char hex near sha256/createHash usage)
rg -oP 'var\s+\w+="([0-9a-f]{12})"' cli.js          # v2.1.92: 59cf53e54c78

# Character indices ([N,N,N].map( patterns)
rg -oP '\[(\d+),(\d+),(\d+)\]\.map\(' cli.js          # v2.1.92: [4,7,20]

# Version (near PACKAGE_URL in build config)
rg -oP 'PACKAGE_URL:"@anthropic-ai/claude-code"[^}]*?VERSION:"(\d+\.\d+\.\d+)"' cli.js

# xxHash seed (Bun only — search for PRIME1/PRIME2 constants near .data section)
# 0x9E3779B185EBCA87 (PRIME1), 0xC2B2AE3D27D4EB4F (PRIME2)
lldb -p $(pgrep -f claude) -o "watchpoint set expression -s 5 -- &cch_memory_addr"
```

### Phase 3: Algorithm Verification

```bash
python3 cch-sign.py header "Say hello" --cache          # Generate test billing header
cch-traffic-monitor.sh capture --duration 30 &
claude -p "Say hello" --model claude-haiku-4-5 2>/dev/null
# Parse captured request to compare actual billing header
```

### Phase 4: Traffic Baseline & Drift Detection

```bash
cch-traffic-monitor.sh capture --output baseline-v2.1.92.json
# After CLI update:
cch-traffic-monitor.sh capture --output current-vX.Y.Z.json
cch-traffic-monitor.sh diff baseline-v2.1.92.json current-vX.Y.Z.json
```

Watch for: new/changed headers or `anthropic-beta` values; new billing header fields or different `cch` format; new body fields (`research_preview_*`, `context_management`); changed JSON key ordering (affects body hash if xxHash active).

## Phase 5: Plugin Compatibility Debugging (mitmproxy method)

When an opencode plugin breaks for a specific model but works for others, use mitmproxy to diff wire bytes between the working and failing cases, then compare against the real Claude CLI.

### Setup

```bash
# Trust mitmproxy CA cert (once)
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/.mitmproxy/mitmproxy-ca-cert.pem

# Start proxy (use port 8082 — 8080 is taken by OrbStack)
mitmdump -s /tmp/mitm-capture.py --mode regular@8082 '~d api.anthropic.com'

# Run opencode through proxy
HTTPS_PROXY=http://127.0.0.1:8082 HTTP_PROXY=http://127.0.0.1:8082 opencode run -m anthropic/claude-opus-4-6 "hi"

# Run Claude CLI through proxy (requires NODE_EXTRA_CA_CERTS)
HTTPS_PROXY=http://127.0.0.1:8082 HTTP_PROXY=http://127.0.0.1:8082 \
  NODE_EXTRA_CA_CERTS=~/.mitmproxy/mitmproxy-ca-cert.pem \
  claude -p "hi" --model claude-opus-4-6
```

### Capture script pattern

```python
import json
from mitmproxy import http

def request(flow: http.HTTPFlow):
    if "api.anthropic.com" not in flow.request.pretty_host:
        return
    try:
        parsed = json.loads(flow.request.content)
        model = parsed.get('model','?')
    except:
        model = '?'
    ua = flow.request.headers.get('user-agent','')
    src = 'cli' if 'claude-cli' in ua else 'oc'
    open(f'/tmp/{src}-{model.replace("/","-")}.bin','wb').write(flow.request.content)
```

### Diff methodology

```python
import json

with open('/tmp/cli-opus.bin','rb') as f:
    cli = json.load(f)
with open('/tmp/oc-opus.bin','rb') as f:
    oc = json.load(f)

# Top-level key diff
print("only in cli:", set(cli)-set(oc))
print("only in oc: ", set(oc)-set(cli))

# Scalar value diffs
for k in sorted(set(cli)|set(oc)):
    cv, ov = cli.get(k), oc.get(k)
    if not isinstance(cv,(list,dict)) and cv != ov:
        print(f"{k}: cli={repr(cv)[:60]}  oc={repr(ov)[:60]}")
```

### Session finding (April 2026): `thinking` field required for opus-4-6

**Symptom:** `invalid_request_error: Invalid request data` for opus-4-6 in opencode, sonnet works fine.

**Red herrings pursued before finding root cause:**
- `$schema` and `additionalProperties` in tool input_schema (stripped — not the cause)
- `null` top-level fields like `context_management: null` (stripped — not the cause)
- Rate limiting misidentified as request errors (the `invalid_request_error` label is used for both)
- Session ID state (`x-claude-code-session-id`) — not the cause
- `claudecli` provider routing through wrong code path — was a real issue, fixed separately

**Root cause:** CLI diff revealed the real Claude CLI always sends `thinking: {type: "adaptive"}` for opus-4-6 and sonnet-4-6. Opencode sends no `thinking` field. The API requires it and returns `invalid_request_error` without it. Also: `temperature` must be `1` when thinking is enabled — opencode sends `0.2`.

**Fix in `applyBodyTransforms()`:**
```javascript
if (isAdaptiveThinkingModel(parsed.model)) {
  if (!parsed.thinking || parsed.thinking.type !== "adaptive") {
    parsed.thinking = { type: "adaptive" };
  }
  if (parsed.temperature !== undefined && parsed.temperature !== 1) {
    parsed.temperature = 1;
  }
}
```

**Key lesson:** When a model-specific error resists all request-body fixes, capture the real CLI's wire bytes for the same model and diff them. The CLI is the ground truth for what the API expects.

## References

- Original research: a10k.co/b/reverse-engineering-claude-code-cch.html
- Codey (Rust implementation): github.com/tcdent/code
- xxHash specification: github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md
