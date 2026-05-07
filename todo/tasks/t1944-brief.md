---
mode: subagent
---

# t1944: simplification: reduce complexity in session-miner extract.py (156) + compress.py (69)

## Origin

- **Created:** 2026-04-10
- **Session:** claude-code:interactive
- **Created by:** ai-interactive
- **Conversation context:** Qlty maintainability C rating recovery — systematic complexity reduction across all flagged files

## What

Reduce complexity in the session-miner scripts: extract.py at 156 total with `extract_instruction_candidates` at 22 and `build_chunks` with 6 params; compress.py at 69 total.

## Why

Part of Qlty maintainability recovery (C to A). Combined 225 complexity.

## Tier

### Tier checklist (verify before assigning)

- [x] **2 or fewer files to modify?**
- [ ] **Complete code blocks for every edit?**
- [ ] **No judgment or design decisions?** — Requires choosing extraction boundaries
- [x] **No error handling or fallback logic to design?**
- [ ] **Estimate 1h or less?**
- [x] **4 or fewer acceptance criteria?**

**Selected tier:** `tier:standard`

**Tier rationale:** 2 files but requires understanding session-miner pipeline to decompose correctly.

## How (Approach)

### Files to Modify

- `EDIT: .agents/scripts/session-miner/extract.py:230,1026` — decompose `extract_instruction_candidates` into per-signal-type extractors, replace `build_chunks` 6 params with config dataclass
- `EDIT: .agents/scripts/session-miner/compress.py` — decompose into per-compression-stage functions

### Implementation Steps

1. Decompose `extract_instruction_candidates` into signal-specific extractors (e.g., `_extract_correction_signals`, `_extract_preference_signals`)
2. Create a `ChunkConfig` dataclass to replace `build_chunks` 6 params
3. Decompose compress.py into stage functions
4. Verify: `qlty smells --all --no-snippets 2>&1 | grep session-miner` shows no findings

## Acceptance Criteria

- [ ] Both files under total complexity 50
- [ ] No function exceeds complexity 15
- [ ] No function has more than 5 parameters
- [ ] `qlty smells` reports zero findings for both files
- [ ] `python3 extract.py --help` and `python3 compress.py --help` still work
