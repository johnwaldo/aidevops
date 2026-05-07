---
mode: subagent
---

# t1942: simplification: reduce complexity in agent-discovery.py (183) + deduplicate with opencode-agent-discovery.py (146)

## Origin

- **Created:** 2026-04-10
- **Session:** claude-code:interactive
- **Created by:** ai-interactive
- **Conversation context:** Qlty maintainability C rating recovery — systematic complexity reduction across all flagged files

## What

Reduce complexity in both agent discovery scripts and eliminate the 18-line `atomic_json_write` duplication (mass=150). agent-discovery.py at 183 total, opencode-agent-discovery.py at 146 total, plus shared `parse_frontmatter` at 19 each.

## Why

Part of Qlty maintainability recovery (C to A). Combined 329 complexity plus a duplication finding.

## Tier

### Tier checklist (verify before assigning)

- [ ] **2 or fewer files to modify?** — 3 files (2 existing + 1 new shared module)
- [ ] **Complete code blocks for every edit?**
- [ ] **No judgment or design decisions?** — Requires choosing shared module API
- [x] **No error handling or fallback logic to design?**
- [ ] **Estimate 1h or less?**
- [ ] **4 or fewer acceptance criteria?**

**Selected tier:** `tier:standard`

**Tier rationale:** 3 files, requires designing a shared module API and decomposing functions in both consumers. Follow pattern from t1863 (email_shared.py extraction).

## How (Approach)

### Files to Modify

- `NEW: .agents/scripts/lib/discovery_utils.py` — shared module with `atomic_json_write()` and `parse_frontmatter()`, model on `.agents/scripts/lib/email_shared.py`
- `EDIT: .agents/scripts/agent-discovery.py:7-24,144-190` — import from discovery_utils, remove duplicated functions, decompose high-complexity functions
- `EDIT: .agents/scripts/opencode-agent-discovery.py:8-25,194-240,370` — same treatment, reduce `subagent_ref_exists` returns

### Implementation Steps

1. Create `lib/discovery_utils.py` with `atomic_json_write()` and `parse_frontmatter()` extracted verbatim
2. Replace duplicated code in both files with imports
3. Decompose remaining high-complexity functions into smaller helpers
4. Reduce `subagent_ref_exists` returns by consolidating validation logic
5. Verify: `qlty smells --all --no-snippets 2>&1 | grep -E 'agent-discovery|opencode-agent-discovery'` shows no findings

## Acceptance Criteria

- [ ] Shared `discovery_utils.py` module eliminates duplication
- [ ] Both files under total complexity 60
- [ ] No function exceeds complexity 15
- [ ] No duplication findings from qlty smells
- [ ] `python3 agent-discovery.py --help` and `python3 opencode-agent-discovery.py --help` still work
