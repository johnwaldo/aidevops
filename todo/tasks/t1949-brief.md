---
mode: subagent
---

# t1949: simplification: reduce complexity in .opencode/ files — toon.ts (62), api-gateway.ts (65), ai-research.ts (18 func)

## Origin

- **Created:** 2026-04-10
- **Session:** claude-code:interactive
- **Created by:** ai-interactive
- **Conversation context:** Qlty maintainability C rating recovery — systematic complexity reduction across all flagged files

## What

Reduce complexity in the .opencode/ TypeScript files: toon.ts at 62 total with `convertPrimitive` (6 returns), `parseLiteral` (8 returns), `detectKnownValue` (6 returns); api-gateway.ts at 65 total; ai-research.ts with `buildSystemPrompt` at 18 complexity.

## Why

Part of Qlty maintainability recovery (C to A). Combined ~145 complexity across the .opencode/ directory.

## Tier

### Tier checklist (verify before assigning)

- [ ] **2 or fewer files to modify?** — 3 files
- [ ] **Complete code blocks for every edit?**
- [ ] **No judgment or design decisions?** — Requires choosing lookup map vs switch patterns
- [x] **No error handling or fallback logic to design?**
- [x] **Estimate 1h or less?**
- [ ] **4 or fewer acceptance criteria?**

**Selected tier:** `tier:standard`

**Tier rationale:** 3 TypeScript files. toon.ts multi-return functions are best solved with lookup maps — a design choice the worker needs to make.

## How (Approach)

### Files to Modify

- `EDIT: .opencode/lib/toon.ts:33,148,242` — replace multi-return functions with lookup maps (type to converter, token to literal, value to known)
- `EDIT: .opencode/server/api-gateway.ts` — decompose into per-route handler functions, extract middleware
- `EDIT: .opencode/lib/ai-research.ts:237` — decompose `buildSystemPrompt` into section builders

### Implementation Steps

1. Replace `convertPrimitive`, `parseLiteral`, `detectKnownValue` with `Record<string, handler>` lookup maps
2. Extract api-gateway route handlers into separate functions
3. Split `buildSystemPrompt` into `buildContextSection`, `buildInstructionSection`, etc.
4. Verify: `qlty smells --all --no-snippets 2>&1 | grep '\.opencode/'` shows no findings

## Acceptance Criteria

- [ ] All 3 files under total complexity 40
- [ ] No function exceeds complexity 15
- [ ] No function has more than 5 returns
- [ ] `qlty smells` reports zero findings for all 3 files
- [ ] TypeScript compilation still passes
