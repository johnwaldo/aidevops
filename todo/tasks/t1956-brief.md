---
mode: subagent
---

# t1956: simplification: reduce complexity in simplex-bot commands.ts (61) + index.ts (58)

## Origin

- **Created:** 2026-04-10
- **Session:** claude-code:interactive
- **Created by:** ai-interactive
- **Conversation context:** Qlty maintainability C rating recovery — systematic complexity reduction across all flagged files

## What

Reduce complexity in SimpleX bot TypeScript files: commands.ts at 61 total, index.ts at 58 total.

## Why

Part of Qlty maintainability recovery (C to A). Combined 119 complexity.

## Tier

### Tier checklist (verify before assigning)

- [x] **2 or fewer files to modify?**
- [ ] **Complete code blocks for every edit?**
- [ ] **No judgment or design decisions?** — Requires choosing command registry pattern
- [x] **No error handling or fallback logic to design?**
- [x] **Estimate 1h or less?**
- [x] **4 or fewer acceptance criteria?**

**Selected tier:** `tier:standard`

**Tier rationale:** 2 files but requires understanding SimpleX bot protocol to decompose correctly.

## How (Approach)

### Files to Modify

- `EDIT: .agents/scripts/simplex-bot/src/commands.ts` — extract per-command handlers into a command registry map
- `EDIT: .agents/scripts/simplex-bot/src/index.ts` — decompose into connection-setup, message-handling, and lifecycle-management functions

### Implementation Steps

1. Create a `CommandHandler` type and registry map in commands.ts
2. Extract each command case into a named handler function
3. Decompose index.ts into lifecycle phases
4. Verify: `qlty smells --all --no-snippets 2>&1 | grep simplex-bot` shows no findings

## Acceptance Criteria

- [ ] Both files under total complexity 40
- [ ] No function exceeds complexity 15
- [ ] `qlty smells` reports zero findings for both files
- [ ] Bot still compiles and runs
