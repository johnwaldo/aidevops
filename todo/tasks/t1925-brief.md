<!-- SPDX-License-Identifier: MIT -->
<!-- SPDX-FileCopyrightText: 2025-2026 Marcus Quinn -->
# t1925: Pulse routine evaluation — repeat: field dispatch and comment handling

## Origin

- **Created:** 2026-04-08
- **Session:** OpenCode interactive
- **Created by:** marcus + ai-interactive
- **Conversation context:** The pulse already runs on a 2-minute launchd cycle. Adding repeat: field awareness is a natural extension — no new scheduler needed. Script-only routines (run:) burn zero LLM tokens. Uses platform-native scheduling (launchd/systemd) via pulse, not crontab.

## What

Teach the pulse to evaluate `repeat:` fields in routines repo TODO.md and dispatch due routines:

1. **Script-only** (`run:` field) — execute script directly, zero LLM tokens
2. **LLM-requiring** (`agent:` field) — dispatch via `headless-runtime-helper.sh`

New `routine-schedule-helper.sh` for deterministic schedule parsing.

Comment handling: existing pulse comment-watching infrastructure picks up new comments on routine issues. Modification requests create TODOs; questions get LLM responses.

## Why

The pulse already evaluates TODO entries on a 2-minute cycle. Routines are just repeating TODOs — the pulse gains one new phase. No separate crontab/launchd entries per routine. Script-only dispatch (`run:`) is critical for high-frequency routines (health checks) where LLM token spend would be wasteful.

## Tier

### Tier checklist (verify before assigning)

- [ ] **2 or fewer files to modify?** — 4+ files
- [ ] **Complete code blocks for every edit?** — approach description with signatures
- [ ] **No judgment or design decisions?** — schedule parsing logic, dispatch routing
- [ ] **No error handling or fallback logic to design?** — failure tracking, retry
- [ ] **Estimate 1h or less?** — ~4h
- [ ] **4 or fewer acceptance criteria?** — 7

**Selected tier:** `tier:standard`

**Tier rationale:** Multiple files, schedule parsing logic, but follows established pulse dispatch patterns.

## How (Approach)

### Files to Modify

- `NEW: .agents/scripts/routine-schedule-helper.sh` — deterministic schedule parser
- `EDIT: .agents/scripts/pulse-wrapper.sh` — add routine evaluation phase
- `EDIT: .agents/scripts/commands/pulse.md` — document routine evaluation
- `EDIT: .agents/automate.md` — add routine dispatch to Quick Reference

### Implementation Steps

1. Create `routine-schedule-helper.sh`:
   - `is-due <expression> <last-run-epoch>` → exit 0 if due, exit 1 if not
   - `next-run <expression>` → prints next run ISO timestamp
   - `parse <expression>` → outputs normalised fields (for debugging)
   - Supports: `daily(@HH:MM)`, `weekly(day@HH:MM)`, `monthly(N@HH:MM)`, `cron(5-field-expr)`
   - Pure bash date arithmetic, no external deps beyond `date`

2. Add routine evaluation phase to `pulse-wrapper.sh` after task dispatch:
   - Find routines repo path from `repos.json` (where slug contains `routines` and `priority: "tooling"`)
   - Read its `TODO.md`, extract `[x]` lines with `repeat:` fields
   - For each: check `routine-schedule-helper.sh is-due` against `routine-state.json`
   - `run:` → execute script, capture exit code + output
   - `agent:` → `headless-runtime-helper.sh run --agent NAME`
   - Update `routine-state.json` with last-run timestamp
   - Call `routine-log-helper.sh update` (t1926) if available

3. State file: `~/.aidevops/.agent-workspace/routine-state.json`
   ```json
   {
     "r001": {"last_run": "2026-04-07T09:02:14Z", "last_status": "success"},
     "r002": {"last_run": "2026-04-07T06:00:03Z", "last_status": "failure"}
   }
   ```

### Verification

```bash
# Test schedule parser
~/.aidevops/agents/scripts/routine-schedule-helper.sh is-due "daily(@09:00)" 0 && echo "due" || echo "not due"
~/.aidevops/agents/scripts/routine-schedule-helper.sh next-run "weekly(mon@09:00)"
# Verify pulse integration
grep -q 'routine' ~/.aidevops/agents/scripts/pulse-wrapper.sh
```

## Acceptance Criteria

- [ ] Pulse evaluates `repeat:` entries on each cycle
  ```yaml
  verify:
    method: bash
    run: "grep -q 'repeat\\|routine' .agents/scripts/pulse-wrapper.sh"
  ```
- [ ] `[x]` entries dispatched when due; `[ ]` entries skipped
- [ ] `run:` routines execute script directly (no headless-runtime-helper call)
- [ ] `agent:` routines dispatch via headless runtime
- [ ] Last-run timestamps persisted in `routine-state.json`
- [ ] `routine-schedule-helper.sh is-due` correctly evaluates all 4 expression types
  ```yaml
  verify:
    method: bash
    run: "test -f .agents/scripts/routine-schedule-helper.sh && bash .agents/scripts/routine-schedule-helper.sh is-due 'daily(@09:00)' 0"
  ```
- [ ] Comments on routine issues handled by existing pulse comment infrastructure

## Context & Decisions

- Pulse-based evaluation chosen over per-routine crontab/launchd entries — simpler, consistent with existing architecture
- Uses platform-native scheduling via pulse (launchd on macOS, systemd on Linux), not crontab
- Script-only (`run:`) routines are critical for zero-token-cost automation (health checks, backups, etc.)
- Custom scripts live in `~/.aidevops/agents/custom/scripts/` — the `run:` path is relative to `~/.aidevops/agents/`
- `routine-state.json` is ephemeral working data, not version-controlled

## Relevant Files

- `.agents/scripts/pulse-wrapper.sh` — main pulse loop to extend
- `.agents/scripts/headless-runtime-helper.sh` — dispatch target for agent: routines
- `.agents/scripts/routine-helper.sh:155` — `parse_cron_to_launchd_xml()` for cron expression reference
- `.agents/automate.md` — Automate agent docs

## Dependencies

- **Blocked by:** t1923 (format), t1924 (routines repo)
- **Blocks:** t1926 (logging needs execution data)
- **External:** none

## Estimate Breakdown

| Phase | Time | Notes |
|-------|------|-------|
| Research/read | 30m | Read pulse-wrapper.sh, routine-helper.sh |
| Implementation | 3h | Schedule parser, pulse integration, state tracking |
| Testing | 1h | Test all 4 schedule types, both dispatch paths |
| **Total** | **~4h** | |
