---
mode: subagent
---

# t1952: simplification: reduce remaining higgsfield complexity — commands (334), video (322), common (289), api (72)

## Origin

- **Created:** 2026-04-10
- **Session:** claude-code:interactive
- **Created by:** ai-interactive
- **Conversation context:** Qlty maintainability C rating recovery — t1862 was marked completed but qlty smells still reports high complexity in all 4 files

## What

t1862 was marked completed but qlty smells still reports high complexity in all 4 higgsfield files. Combined 1017 complexity — the single largest cluster in the repo (~25% of all findings).

| File | Complexity | Worst function |
|------|-----------|----------------|
| `higgsfield-commands.mjs` | 334 | High total complexity |
| `higgsfield-video.mjs` | 322 | `downloadVideoFromApiData` (26), `generateLipsync` (21), `matchJobSetsToSubmittedJobs` (25), `downloadMatchedVideos` (23) |
| `higgsfield-common.mjs` | 289 | `diffRoutesAgainstCache` (18), complex binary expression |
| `higgsfield-api.mjs` | 72 | `apiRequest` (22) |

## Why

Part of Qlty maintainability recovery (C to A). This cluster alone accounts for ~25% of all complexity findings. Previous t1862 may have partially addressed this but smells persist — this is the follow-up to finish the job.

## Tier

### Tier checklist (verify before assigning)

- [ ] **2 or fewer files to modify?** — 4 files
- [ ] **Complete code blocks for every edit?**
- [ ] **No judgment or design decisions?** — Requires designing module boundaries for 4 tightly coupled files
- [ ] **No error handling or fallback logic to design?** — API error handling
- [ ] **Estimate 1h or less?**
- [ ] **4 or fewer acceptance criteria?**

**Selected tier:** `tier:standard`

**Tier rationale:** 4 files with 1017 combined complexity. Requires understanding the higgsfield API client architecture to decompose correctly. Follow whatever pattern t1862 established.

## How (Approach)

### Files to Modify

- `EDIT: .agents/scripts/higgsfield/higgsfield-commands.mjs` — decompose into per-command modules or command registry
- `EDIT: .agents/scripts/higgsfield/higgsfield-video.mjs` — decompose download/lipsync/matching into pipeline stages
- `EDIT: .agents/scripts/higgsfield/higgsfield-common.mjs` — extract route diffing, simplify binary expressions
- `EDIT: .agents/scripts/higgsfield/higgsfield-api.mjs:99` — decompose `apiRequest` (22) into request-building, error-handling, response-parsing

### Implementation Steps

1. Check what t1862 already did — build on that decomposition
2. Further decompose any remaining high-complexity functions
3. Extract command dispatch into registry pattern
4. Simplify complex binary expressions into named helpers
5. Verify: `qlty smells --all --no-snippets 2>&1 | grep higgsfield` shows no findings

## Acceptance Criteria

- [ ] All 4 files under total complexity 50
- [ ] No function exceeds complexity 15
- [ ] No complex binary expressions
- [ ] `qlty smells` reports zero findings for all higgsfield files
- [ ] `node higgsfield-commands.mjs --help` still works
