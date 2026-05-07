---
mode: subagent
---

# t1947: simplification: reduce complexity in tabby-profile-sync.py (84), add-related-docs.py (89), generate-manifest.py (88), pageindex-generator.py (66)

## Origin

- **Created:** 2026-04-10
- **Session:** claude-code:interactive
- **Created by:** ai-interactive
- **Conversation context:** Qlty maintainability C rating recovery — systematic complexity reduction across all flagged files

## What

Reduce complexity in four utility scripts: add-related-docs.py at 89, generate-manifest.py at 88 with `build_threads` at 36 and deeply nested level 5, tabby-profile-sync.py at 84 with `main` at 35, pageindex-generator.py at 66 with `build_pageindex_tree` at 25 and `build_tree_recursive` with 7 params.

## Why

Part of Qlty maintainability recovery (C to A). Combined 327 complexity across 4 doc/config utility scripts.

## Tier

### Tier checklist (verify before assigning)

- [ ] **2 or fewer files to modify?** — 4 files
- [ ] **Complete code blocks for every edit?**
- [ ] **No judgment or design decisions?**
- [x] **No error handling or fallback logic to design?**
- [ ] **Estimate 1h or less?**
- [ ] **4 or fewer acceptance criteria?**

**Selected tier:** `tier:standard`

**Tier rationale:** 4 files with varied decomposition needs. Each is independent so can be addressed sequentially.

## How (Approach)

### Files to Modify

- `EDIT: .agents/scripts/add-related-docs.py` — decompose into frontmatter-parsing, link-discovery, and file-update phases
- `EDIT: .agents/scripts/generate-manifest.py:146,176` — decompose `build_threads` (36) into thread-discovery and thread-assembly, flatten nesting
- `EDIT: .agents/scripts/tabby-profile-sync.py:524` — decompose `main` (35) into per-sync-stage functions
- `EDIT: .agents/scripts/pageindex-generator.py:130,190` — replace 7 params with context object, decompose `build_pageindex_tree` (25)

### Implementation Steps

1. Decompose each file's hot functions into smaller helpers
2. Replace multi-param signatures with context/config objects
3. Flatten deeply nested control flow in generate-manifest.py
4. Verify each: `qlty smells --all --no-snippets 2>&1 | grep <filename>` shows no findings

## Acceptance Criteria

- [ ] All 4 files under total complexity 50
- [ ] No function exceeds complexity 15
- [ ] No function has more than 5 parameters
- [ ] No deeply nested control flow (level 5+)
- [ ] `qlty smells` reports zero findings for all 4 files
