---
mode: subagent
---

# t1943: simplification: reduce complexity in email stack — imap_adapter (135), voice-miner (156), normaliser (87), thread-reconstruction (70), parser (54)

## Origin

- **Created:** 2026-04-10
- **Session:** claude-code:interactive
- **Created by:** ai-interactive
- **Conversation context:** Qlty maintainability C rating recovery — systematic complexity reduction across all flagged files

## What

Reduce complexity across 6 remaining email processing scripts that still have Qlty smells. email_jmap_adapter (t1861) and email-summary/entity-extraction (t1863) were already addressed.

| File | Complexity | Worst function |
|------|-----------|----------------|
| `email_imap_adapter.py` | 135 | `cmd_fetch_body` (31), `_parse_envelope_from_fetch` (25), deeply nested (level 5) |
| `email-voice-miner.py` | 156 | `strip_quoted_content` (21), `fetch_sent_emails` (20), `detect_sent_folder` (20), `main` 6 returns |
| `email_normaliser.py` | 87 | High total complexity |
| `email-thread-reconstruction.py` | 70 | `build_thread_graph` (20) |
| `email_parser.py` | 54 | High total complexity |
| `email-to-markdown.py` | — | `email_to_markdown` has 9 parameters |

## Why

Part of Qlty maintainability recovery (C to A). Combined ~502 complexity across 6 files in the email subsystem.

## Tier

### Tier checklist (verify before assigning)

- [ ] **2 or fewer files to modify?** — 6 files
- [ ] **Complete code blocks for every edit?**
- [ ] **No judgment or design decisions?** — Requires choosing decomposition boundaries per file
- [ ] **No error handling or fallback logic to design?** — IMAP adapter has error handling
- [ ] **Estimate 1h or less?**
- [ ] **4 or fewer acceptance criteria?**

**Selected tier:** `tier:standard`

**Tier rationale:** 6 files with varied decomposition needs. Follow patterns from t1861 and t1863 which successfully reduced email_jmap_adapter and email-summary.

## How (Approach)

### Files to Modify

- `EDIT: .agents/scripts/email_imap_adapter.py:229-310,365-430` — decompose `_parse_envelope_from_fetch` into field-specific parsers, flatten nested control flow in `cmd_fetch_body`
- `EDIT: .agents/scripts/email-voice-miner.py:174,213,291,909` — extract folder detection into lookup table, decompose `strip_quoted_content`, reduce `main` returns
- `EDIT: .agents/scripts/email_normaliser.py` — decompose into per-normalisation-step functions
- `EDIT: .agents/scripts/email-thread-reconstruction.py:133` — decompose `build_thread_graph` into edge-building and cycle-detection phases
- `EDIT: .agents/scripts/email_parser.py` — extract parsing stages into separate functions
- `EDIT: .agents/scripts/email-to-markdown.py:209` — replace 9 params with a dataclass/dict options object

### Implementation Steps

1. Start with `email_imap_adapter.py` — highest complexity, flatten nesting first
2. Decompose `email-voice-miner.py` hot functions using lookup tables for folder detection
3. Apply per-stage decomposition to normaliser, parser, and thread-reconstruction
4. Replace `email_to_markdown` 9-param signature with options dataclass
5. Verify each file: `qlty smells --all --no-snippets 2>&1 | grep <filename>`

## Acceptance Criteria

- [ ] All 6 files under total complexity 50
- [ ] No function exceeds complexity 15
- [ ] No function has more than 5 returns or 6 parameters
- [ ] No deeply nested control flow (level 5+)
- [ ] `qlty smells` reports zero findings for all 6 files
- [ ] Existing functionality preserved
