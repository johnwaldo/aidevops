---
mode: subagent
---

# t1945: simplification: reduce complexity in playwright-contrast.mjs (132) + browser-qa.mjs (85)

## Origin

- **Created:** 2026-04-10
- **Session:** claude-code:interactive
- **Created by:** ai-interactive
- **Conversation context:** Qlty maintainability C rating recovery — systematic complexity reduction across all flagged files

## What

Reduce complexity in browser QA scripts: playwright-contrast.mjs at 132 total with `extractContrastData` at 95 complexity and 21 returns (worst single function in scripts/); browser-qa.mjs at 85 total with `visitPage` at 19 and `parseArgs` at 18.

## Why

Part of Qlty maintainability recovery (C to A). Combined 217 complexity. `extractContrastData` at 95 is the single worst function-level complexity in the scripts directory.

## Tier

### Tier checklist (verify before assigning)

- [x] **2 or fewer files to modify?**
- [ ] **Complete code blocks for every edit?**
- [ ] **No judgment or design decisions?** — Requires choosing how to lift nested functions
- [x] **No error handling or fallback logic to design?**
- [ ] **Estimate 1h or less?**
- [x] **4 or fewer acceptance criteria?**

**Selected tier:** `tier:standard`

**Tier rationale:** 2 files but `extractContrastData` at 95 complexity requires careful decomposition — nested helper functions need lifting to module scope.

## How (Approach)

### Files to Modify

- `EDIT: .agents/scripts/accessibility/playwright-contrast.mjs:86-380` — lift nested functions (`parseColor`, `computeContrast`, `getSelector`) to module scope, decompose `extractContrastData` into `collectElements`, `analyzeContrast`, `buildReport`
- `EDIT: .agents/scripts/browser-qa/browser-qa.mjs:31-90,150-290,312` — decompose `visitPage` into `navigatePage`/`captureScreenshot`/`extractPageData`, simplify `parseArgs` with declarative options map, extract complex binary expression at line 312

### Implementation Steps

1. Lift all nested functions in `extractContrastData` to module scope — this alone fixes most returns and complexity
2. Split remaining logic into collection, analysis, and reporting phases
3. Decompose browser-qa functions and extract binary expression to named helper
4. Verify: `qlty smells --all --no-snippets 2>&1 | grep -E 'playwright-contrast|browser-qa'` shows no findings

## Acceptance Criteria

- [ ] Both files under total complexity 50
- [ ] No function exceeds complexity 15
- [ ] No function has more than 5 returns
- [ ] No complex binary expressions
- [ ] `qlty smells` reports zero findings for both files
