---
mode: subagent
---

# t1946: simplification: reduce complexity in cross-document-linking.py (130), extraction_pipeline.py (103), voice-bridge.py (102)

## Origin

- **Created:** 2026-04-10
- **Session:** claude-code:interactive
- **Created by:** ai-interactive
- **Conversation context:** Qlty maintainability C rating recovery — systematic complexity reduction across all flagged files

## What

Reduce complexity in three standalone processing scripts: cross-document-linking.py at 130, extraction_pipeline.py at 103, voice-bridge.py at 102.

## Why

Part of Qlty maintainability recovery (C to A). Combined 335 complexity across 3 data processing scripts.

## Tier

### Tier checklist (verify before assigning)

- [ ] **2 or fewer files to modify?** — 3 files
- [ ] **Complete code blocks for every edit?**
- [ ] **No judgment or design decisions?** — Requires choosing decomposition boundaries
- [x] **No error handling or fallback logic to design?**
- [ ] **Estimate 1h or less?**
- [x] **4 or fewer acceptance criteria?**

**Selected tier:** `tier:standard`

**Tier rationale:** 3 files with independent decomposition needs. Each is a standalone script so changes are isolated.

## How (Approach)

### Files to Modify

- `EDIT: .agents/scripts/cross-document-linking.py` — decompose into link-discovery, link-validation, and link-insertion phases
- `EDIT: .agents/scripts/extraction_pipeline.py` — decompose into per-extraction-stage functions with a pipeline runner
- `EDIT: .agents/scripts/voice-bridge.py` — decompose into audio-capture, transcription, and command-dispatch modules

### Implementation Steps

1. Decompose each file into phase/stage functions
2. Create a coordinator function that calls phases in sequence
3. Verify each: `qlty smells --all --no-snippets 2>&1 | grep <filename>` shows no findings

## Acceptance Criteria

- [ ] All 3 files under total complexity 50
- [ ] No function exceeds complexity 15
- [ ] `qlty smells` reports zero findings for all 3 files
- [ ] Existing functionality preserved
