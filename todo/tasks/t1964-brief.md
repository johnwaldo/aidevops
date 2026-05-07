<!-- SPDX-License-Identifier: MIT -->
<!-- SPDX-FileCopyrightText: 2025-2026 Marcus Quinn -->
# t1964: init-routines-helper — skip fake-metric update when core tracking issue already exists

## Origin

- **Created:** 2026-04-12
- **Session:** claude-code:interactive
- **Created by:** ai-interactive (discovered while setting up turbostarter mirror)
- **Parent task:** none
- **Conversation context:** User asked for private mirror setup; during the work I accidentally invoked `init-routines-helper.sh` with no args (the dispatcher for `aidevops init-routines`), which is documented as "create personal repo". The invocation was idempotent for the heavy gh API calls (repo create, clone, issue create were all no-ops), BUT the per-routine `routine-log-helper.sh update <rid> --status success --duration 0` call at line 763 is NOT idempotent: it appends a run entry, increments streak counters, and moves avg_duration toward 0. My one exploratory invocation polluted every core routine's metrics with a fake success entry.

## What

Make the `_create_core_issues` function in `init-routines-helper.sh` idempotent with respect to metrics: only fire the "trigger body rebuild" update call (`routine-log-helper.sh update ... --status success --duration 0`) for routines whose tracking state file did NOT already exist. For routines that already have state, keep the label/description refresh but skip the run-recording side effect.

Also correct the output messages so they accurately report "creating" vs "already exists" rather than always printing `Creating issue for rNNN: ...`.

## Why

Every bare invocation of `init-routines-helper.sh` (which is the documented default mode for `aidevops init-routines`, used during setup and user exploration) silently pollutes the core routine metrics for all 12 `r901-r912` routines. Observed state after one exploratory call: `r906` now shows `streak_count: 4`, `last_status: success`, `last_duration: 0` — four fake runs that never executed. This:

- Breaks the reliability of streak counters that users rely on to spot failing routines
- Drags `avg_duration` and `total_cost` metrics toward zero
- Makes the "routines never fail" dashboards look better than they are
- Any additional `aidevops update` or setup run adds more fake entries

This is strictly worse than a no-op; the bug produces misleading observability data.

## Tier

### Tier checklist

- [x] **2 or fewer files to modify?** — only `.agents/scripts/init-routines-helper.sh`
- [x] **Complete code blocks for every edit?** — yes, exact diff provided below
- [x] **No judgment or design decisions?** — straightforward "if file exists, skip update"
- [x] **No error handling or fallback logic to design?** — no
- [x] **Estimate 1h or less?** — yes, ~30m
- [x] **4 or fewer acceptance criteria?** — 3

**Selected tier:** `tier:simple`

**Tier rationale:** Single-file, exact diff, no design decisions — just gate an unconditional call behind a state-file existence check.

## How (Approach)

### Files to Modify

- `EDIT: .agents/scripts/init-routines-helper.sh:749-765` — change the loop to detect existing state and skip run-recording for already-initialised routines

### Implementation Steps

1. At the top of the per-routine loop body, capture whether the routine already has a tracking state file:

   ```bash
   local state_file="${HOME}/.aidevops/.agent-workspace/cron/${rid}/routine-state.json"
   local preexisting_state=false
   [[ -f "$state_file" ]] && preexisting_state=true

   if [[ "$preexisting_state" == true ]]; then
       print_info "Tracking issue for ${rid}: ${short_title} already exists — refreshing description only"
   else
       print_info "Creating tracking issue for ${rid}: ${short_title}..."
   fi
   ```

2. Keep the `routine-log-helper.sh create-issue` call unchanged (it is already idempotent — returns existing issue number when state exists).

3. Gate the trailing `routine-log-helper.sh update ... --status success --duration 0` call on `$preexisting_state == false`:

   ```bash
   if [[ -n "$issue_num" ]] && [[ "$issue_num" =~ ^[0-9]+$ ]]; then
       gh issue edit "$issue_num" --repo "$slug" --add-label "routine-tracking" 2>/dev/null || true
       _store_routine_description "$rid" "$short_title" "$human_schedule" "$script" "$rtype"
       if [[ "$preexisting_state" != true ]]; then
           # Only fire the initial body-rebuild on fresh init — otherwise we
           # append a fake success/duration=0 entry to every core routine on
           # every invocation, polluting streak and avg_duration metrics.
           bash "$log_helper" update "$rid" --status success --duration 0 2>/dev/null || true
       fi
   fi
   ```

4. Run shellcheck on the modified script.
5. Exercise the path by running `init-routines-helper.sh` twice in a row on a clean test state and confirming only the first run records run metrics.

### Verification

```bash
shellcheck .agents/scripts/init-routines-helper.sh

# Regression test: before fix, streak would increment; after fix, it should not.
BEFORE=$(jq -r '.streak_count // 0' ~/.aidevops/.agent-workspace/cron/r906/routine-state.json)
bash .agents/scripts/init-routines-helper.sh 2>/dev/null
AFTER=$(jq -r '.streak_count // 0' ~/.aidevops/.agent-workspace/cron/r906/routine-state.json)
test "$BEFORE" = "$AFTER" && echo "PASS: streak unchanged" || echo "FAIL: streak incremented"
```

## Acceptance Criteria

- [ ] Running `init-routines-helper.sh` against a repo with pre-existing tracking state does not increment `streak_count`, does not append to runs logs, and does not change `last_run`/`last_status`/`last_duration` for any `r9NN` routine.
- [ ] Fresh initialisation (state file absent) still fires the initial body-rebuild update so the first issue body is populated.
- [ ] Output messages distinguish "Creating tracking issue for rNNN" (new) from "Tracking issue for rNNN already exists — refreshing description only" (existing).
- [ ] `shellcheck .agents/scripts/init-routines-helper.sh` is clean.

## Context & Decisions

- **Why this narrow fix instead of restructuring the default behaviour:** Changing the no-arg default (e.g., requiring a subcommand or defaulting to `--dry-run`) would break `aidevops init-routines` invocation from the CLI and break any user/setup-script call sites. The narrow fix is zero-regression: existing callers still get repo scaffolding, label creation, description storage, and initial body population for fresh routines; the only behaviour change is that redundant metric writes on existing routines are suppressed.
- **`_routines.sh` path:** `setup.sh` sources `init-routines-helper.sh` and calls `detect_and_create_all` directly, NOT `main`. Both paths eventually land in `_create_core_issues`, so the fix covers both setup and CLI invocation.
- **`cmd_create_issue` in `routine-log-helper.sh` is already idempotent** (line 873: returns early with existing issue number). Only the `cmd_update` path is the source of pollution.

## Relevant Files

- `.agents/scripts/init-routines-helper.sh:749-765` — the loop to patch
- `.agents/scripts/routine-log-helper.sh:596-665` — `cmd_update` showing why the call is non-idempotent (line 631: `_append_local_log`)
- `.agents/scripts/routine-log-helper.sh:858-906` — `cmd_create_issue` showing the existing idempotency
- `.agents/scripts/setup/_routines.sh` — caller that sources the helper for setup.sh

## Dependencies

- **Blocked by:** none
- **Blocks:** cleanup task for already-polluted metrics (optional follow-up)
- **External:** none

## Estimate Breakdown

| Phase | Time | Notes |
|-------|------|-------|
| Research/read | 5m | Already complete (this session) |
| Implementation | 15m | Single-file edit, ~15 lines |
| Testing | 10m | Run-twice regression harness |
| PR | 5m | Self-approve if CI passes |

**Total estimate:** ~35m
