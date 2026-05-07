<!-- SPDX-License-Identifier: MIT -->
<!-- SPDX-FileCopyrightText: 2025-2026 Marcus Quinn -->
# t1923: TODO format — repeat:, run:, agent: fields for recurring routines

## Origin

- **Created:** 2026-04-08
- **Session:** OpenCode interactive
- **Created by:** marcus + ai-interactive
- **Conversation context:** Review of GH#17712 ("Hands" proposal) identified a real gap in recurring job definitions. Rather than building a parallel system, extend the existing TODO format to support routines as repeating TODOs.

## What

Extend the TODO.md format specification to support recurring routine definitions with three new fields:

- `repeat:` — schedule expression: `daily(@HH:MM)`, `weekly(day@HH:MM)`, `monthly(N@HH:MM)`, `cron(5-field-expr)`
- `run:` — path to a script for pure-script routines (no LLM tokens). Relative to `~/.aidevops/agents/`
- `agent:` — agent name for LLM-requiring routines. Dispatched via `headless-runtime-helper.sh`
- `[x]` = enabled, `[ ]` = disabled/paused. Pulse skips `[ ]` routines.
- `r`-prefix IDs (`r001`, `r002`) distinguish routines from tasks (`t`-prefix)

Create the reference doc for the full routines system and update existing command docs.

## Why

GH#17712 identified a genuine gap — no declarative, git-tracked format for recurring operational jobs. The contributor proposed HAND.toml, but that duplicates cron-helper.sh, routine-helper.sh, and pulse-wrapper.sh. Extending the TODO format reuses proven infrastructure and keeps routines as first-class tracked items.

## Tier

### Tier checklist (verify before assigning)

- [x] **2 or fewer files to modify?** — 3 edits + 1 new, borderline
- [ ] **Complete code blocks for every edit?** — narrative guidance, not verbatim blocks
- [x] **No judgment or design decisions?** — format is specified
- [x] **No error handling or fallback logic to design?** — docs only
- [x] **Estimate 1h or less?** — ~1.5h
- [x] **4 or fewer acceptance criteria?** — 5

**Selected tier:** `tier:standard`

**Tier rationale:** 3 edits + 1 new file, format design already decided but worker needs to write prose fitting existing doc style.

## How (Approach)

### Files to Modify

- `EDIT: TODO.md:10-50` — add `repeat:`, `run:`, `agent:` fields to the Format section, document `r`-prefix IDs
- `NEW: .agents/reference/routines.md` — full reference doc for the routines system
- `EDIT: .agents/scripts/commands/routine.md` — update to reference TODO-based routine definitions
- `EDIT: .agents/AGENTS.md` — add Routines section under Task Lifecycle (if not already added by harness update)

### Implementation Steps

1. Add to TODO.md Format section after the Time fields block:

```markdown
**Routine fields:**

- `repeat:` — schedule expression for recurring routines
  - `repeat:daily(@HH:MM)` — every day at specified time
  - `repeat:weekly(day@HH:MM)` — every week on specified day (mon, tue, etc.)
  - `repeat:monthly(N@HH:MM)` — monthly on day N at specified time
  - `repeat:cron(expr)` — raw 5-field cron expression for complex schedules
- `run:` — path to script for pure-script execution (no LLM tokens). Relative to `~/.aidevops/agents/`
- `agent:` — agent name for LLM-requiring routines (dispatched via headless runtime)

**Routine IDs:** Use `r` prefix (`r001`, `r002`) to distinguish from tasks (`t` prefix).

**Enabled/disabled:** `[x]` = enabled (pulse dispatches when due), `[ ]` = disabled (pulse skips).
```

2. Create `.agents/reference/routines.md` with: architecture overview, format spec, dispatch rules (run: vs agent:), routines repo structure, issue tracking pattern, logging approach, examples.

3. Update `/routine` command doc to reference the new TODO-based definitions as the primary approach, with YAML specs as the complex-routine option.

### Verification

```bash
grep -q 'repeat:' TODO.md && grep -q 'run:' TODO.md && grep -q 'agent:' TODO.md
test -f .agents/reference/routines.md
grep -q 'repeat:' .agents/scripts/commands/routine.md
```

## Acceptance Criteria

- [ ] `repeat:` field documented in TODO.md Format section with all 4 syntax variants
  ```yaml
  verify:
    method: bash
    run: "grep -q 'repeat:daily' ~/Git/aidevops/TODO.md"
  ```
- [ ] `run:` and `agent:` fields documented with dispatch rules
  ```yaml
  verify:
    method: bash
    run: "grep -q 'run:' ~/Git/aidevops/TODO.md && grep -q 'agent:' ~/Git/aidevops/TODO.md"
  ```
- [ ] `r`-prefix ID convention documented
  ```yaml
  verify:
    method: bash
    run: "grep -q 'r001' ~/Git/aidevops/TODO.md"
  ```
- [ ] Reference doc `.agents/reference/routines.md` exists with complete format spec
  ```yaml
  verify:
    method: bash
    run: "test -f .agents/reference/routines.md && grep -q 'repeat:' .agents/reference/routines.md"
  ```
- [ ] `/routine` command doc updated to reference TODO-based definitions

## Context & Decisions

- Chose TODO format extension over HAND.toml (GH#17712) to avoid new parser dependency and system duplication
- `r`-prefix chosen to distinguish from `t`-prefix tasks in TODO.md — routines and tasks share the same file but have different semantics
- `[x]`/`[ ]` reuses existing checkbox semantics: checked = active, unchecked = disabled
- `run:` vs `agent:` split is the key design decision — pure scripts burn zero LLM tokens
- Custom agents and scripts live in `~/.aidevops/agents/custom/` (survives updates)

## Relevant Files

- `TODO.md:10-50` — existing format section to extend
- `.agents/scripts/commands/routine.md` — current routine command (YAML spec pattern)
- `.agents/AGENTS.md` — Task Lifecycle section
- `.agents/reference/planning-detail.md` — related planning docs

## Dependencies

- **Blocked by:** nothing (format/docs only)
- **Blocks:** t1924, t1925, t1926 (all need format defined first)
- **External:** none

## Estimate Breakdown

| Phase | Time | Notes |
|-------|------|-------|
| Research/read | 30m | Read existing TODO format, routine command |
| Implementation | 2h | Write format docs, reference doc, update command |
| Testing | 30m | Verify grep-based acceptance criteria |
| **Total** | **3h** | |
