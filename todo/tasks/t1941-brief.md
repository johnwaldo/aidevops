---
mode: subagent
---

# t1941: simplification: reduce complexity in chromium-debug-use.mjs (211)

## Origin

- **Created:** 2026-04-10
- **Session:** claude-code:interactive
- **Created by:** ai-interactive
- **Conversation context:** Qlty maintainability C rating recovery — systematic complexity reduction across all flagged files

## What

Reduce total complexity of `.agents/scripts/chromium-debug-use.mjs` from 211 to under 60. Currently has `runDaemon` at complexity 46, `main` at 28 with 6 returns, `handleCommand` at 18.

## Why

Part of Qlty maintainability recovery (C to A). This is the 5th highest complexity file in the repo at 211 total across 1014 lines.

## Tier

### Tier checklist (verify before assigning)

- [x] **2 or fewer files to modify?**
- [ ] **Complete code blocks for every edit?** — No, decomposition requires design
- [ ] **No judgment or design decisions?** — Requires choosing decomposition boundaries
- [x] **No error handling or fallback logic to design?**
- [ ] **Estimate 1h or less?**
- [x] **4 or fewer acceptance criteria?**

**Selected tier:** `tier:standard`

**Tier rationale:** Single file but requires designing decomposition boundaries for 3 complex functions. Worker needs to understand CDP protocol flow to split correctly.

## How (Approach)

### Files to Modify

- `EDIT: .agents/scripts/chromium-debug-use.mjs:570-630` — decompose `runDaemon()` into per-command handlers
- `EDIT: .agents/scripts/chromium-debug-use.mjs:625-680` — extract `handleCommand()` dispatch into command registry
- `EDIT: .agents/scripts/chromium-debug-use.mjs:897-1010` — reduce `main()` returns with early-exit guards

### Implementation Steps

1. Extract each command case from `runDaemon` into named handler functions (e.g., `handleNavigate`, `handleScreenshot`, `handleEvaluate`)
2. Create a command registry map: `const COMMANDS = { navigate: handleNavigate, ... }`
3. Refactor `main()` to use guard clauses and delegate to command-specific entry points
4. Verify: `qlty smells --all --no-snippets 2>&1 | grep chromium-debug-use` shows no findings

## Acceptance Criteria

- [ ] Total file complexity under 60
- [ ] No function exceeds complexity 15
- [ ] No function has more than 5 returns
- [ ] `qlty smells` reports zero findings for this file
- [ ] `node chromium-debug-use.mjs --help` still works
