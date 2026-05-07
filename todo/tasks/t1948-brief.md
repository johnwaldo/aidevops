---
mode: subagent
---

# t1948: simplification: deduplicate linkedin-automation.py + local-browser-automation.py (27 similar lines)

## Origin

- **Created:** 2026-04-10
- **Session:** claude-code:interactive
- **Created by:** ai-interactive
- **Conversation context:** Qlty maintainability C rating recovery — systematic complexity reduction across all flagged files

## What

Eliminate the 27-line duplication (mass=149) between `linkedin-automation.py` (line 97) and `local-browser-automation.py` (line 189).

## Why

Part of Qlty maintainability recovery (C to A). Duplication finding from qlty smells.

## Tier

### Tier checklist (verify before assigning)

- [ ] **2 or fewer files to modify?** — 3 files (2 existing + 1 new shared module)
- [ ] **Complete code blocks for every edit?**
- [x] **No judgment or design decisions?** — Straightforward extraction
- [x] **No error handling or fallback logic to design?**
- [x] **Estimate 1h or less?**
- [x] **4 or fewer acceptance criteria?**

**Selected tier:** `tier:standard`

**Tier rationale:** 3 files to modify, and the duplicated code blocks are "similar" not "identical" (qlty reports mass=149) — the worker needs to read both files, identify the common abstraction, and design the shared module API. Not copy-paste work.

## How (Approach)

### Files to Modify

- `NEW: .agents/scripts/lib/browser_automation_utils.py` — shared module with the duplicated function(s)
- `EDIT: .agents/scripts/linkedin-automation.py:97` — import and call the shared function
- `EDIT: .agents/scripts/local-browser-automation.py:189` — import and call the shared function

### Implementation Steps

1. Read both files at the flagged lines to identify the exact duplicated code
2. Extract to `lib/browser_automation_utils.py`
3. Replace in both files with imports
4. Verify: `qlty smells --all --no-snippets 2>&1 | grep -E 'linkedin-automation|local-browser-automation'` shows no duplication findings

## Acceptance Criteria

- [ ] No duplication findings from qlty smells for these files
- [ ] Shared module in `lib/browser_automation_utils.py`
- [ ] Both scripts still function correctly
