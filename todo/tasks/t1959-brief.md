---
mode: subagent
---

<!-- SPDX-License-Identifier: MIT -->
<!-- SPDX-FileCopyrightText: 2025-2026 Marcus Quinn -->
# t1959: Wire global circuit breaker to launch failures + canary cache invalidation

## Origin

- **Created:** 2026-04-12
- **Session:** claude-code (interactive)
- **Created by:** ai-interactive (review of GH#18347)
- **Parent task:** none
- **Conversation context:** Review of GH#18347 surfaced a real gap (per-issue backoff doesn't aggregate runtime failures) but the proposed fix (new global counter with auto-reset on launch) had three regression risks against the deliberate per-issue retry design (t1888, GH#2076). User asked for an alternative approach that preserves per-issue retry semantics while adding the missing aggregate signal.

## What

Wire the existing `circuit-breaker-helper.sh` (t1331) into the launch-failure recovery path so systemic runtime breakage trips dispatch globally without overriding the per-issue backoff that lets healthy issues continue making progress. Plus two complementary signals:

1. **Wire `circuit-breaker-helper.sh record-failure`** into `recover_failed_launch_state()` in `pulse-wrapper.sh`, alongside the existing `fast_fail_record` call. Tripping is gated to launch-class failures (`no_worker_process`, `cli_usage_output`) — not stale-timeout or in-execution failures, which already have working backoff.
2. **Invalidate the canary cache** (`${STATE_DIR}/canary-last-pass` in `headless-runtime-helper.sh`) after **3 consecutive `no_worker_process` failures within a single dispatch round**. The next dispatch attempt re-runs the canary, which fails fast if the runtime is actually broken — replacing the stale "passed 25 minutes ago" signal with current truth.
3. **Throttle dispatch batch size to 1** when the previous round hit a high `no_worker_process` failure ratio (>80%). On the **first successful dispatch** in throttled mode, immediately revert to the configured batch size — single recovery proves the runtime is back. This is a soft brake that limits waste during runtime breakage without blocking recovery.

The result: per-issue progress is preserved (each issue still owns its own escalation trajectory), runtime breakage is detected within ~3 dispatch attempts instead of "every issue independently reaches its threshold", and recovery is immediate on first success.

## Why

GH#18347 documented 226 dispatches with 99 failures over 4 days when the headless runtime was broken. The pulse dispatched a full batch per cycle before discovering each worker died, because:

- Per-issue fast-fail backoff (t1888) tracks each issue independently — no aggregate signal across issues.
- The canary cache TTL (1800s / 30 min) returns stale "pass" results long after the runtime breaks, so canary-based pre-flight stops catching the failure.
- The existing global circuit breaker (`circuit-breaker-helper.sh`, t1331) has the right shape — threshold, cooldown, GitHub issue creation — but is **not wired into launch-validation failures**. It only handles task-level failures.

The original GH#18347 proposal (a new fast-fail counter with auto-reset on successful launch) has three regression risks that this approach avoids:

1. **Auto-reset on launch contradicts GH#2076.** `pulse-wrapper.sh:10231-10236` explicitly says: *"Launch confirmed — do NOT reset fast-fail counter here. A successful launch does not mean successful completion."* The same lesson applies at the global level — a counter that resets on launch oscillates: launch succeeds → reset → worker dies → counter from 0. Use the existing breaker's `record-success` semantics, which reset on **completion** signals (PR merged, issue closed), not launch.
2. **Fixed threshold doesn't scale with batch size.** The proposed threshold=10 trips after 0.5 rounds with 20 issues, but takes 5 rounds with 2 issues. The existing breaker's threshold=3 with cooldown semantics is round-relative, not batch-relative.
3. **Conflates transient with systemic.** OOM/resource pressure can kill N workers in one round but clear by the next. A hard halt blocks healthy issues that would have succeeded. The cache-invalidation signal (re-test, don't assume) and batch throttling (slow down, don't stop) preserve recovery without blocking it.

## Tier

### Tier checklist (verify before assigning)

- [ ] **2 or fewer files to modify?** No — 2 files in repo (`pulse-wrapper.sh`, `headless-runtime-helper.sh`) but 4 distinct change sites
- [ ] **Complete code blocks for every edit?** No — counter state, threshold detection, and ratio computation need design
- [ ] **No judgment or design decisions?** No — failure-class gating and ratio semantics need design
- [ ] **No error handling or fallback logic to design?** No — recovery semantics, threshold-state interaction with cooldown
- [x] **Estimate 1h or less?** No — 2-3h
- [ ] **4 or fewer acceptance criteria?** Borderline — 6 criteria

**Selected tier:** `tier:standard`

**Tier rationale:** Multiple files, design decisions on failure classification and round-ratio semantics, fallback/recovery behaviour to define. The pattern (wire existing helper) is established but the exact integration points and counter semantics require judgment. Standard tier with clear file references is the right fit.

## How (Approach)

### Files to Modify

- `EDIT: .agents/scripts/pulse-wrapper.sh:9356` — Add `circuit-breaker-helper.sh record-failure` call alongside `fast_fail_record`, gated to launch-class failures.
- `EDIT: .agents/scripts/pulse-wrapper.sh` (around line 10243, before `recover_failed_launch_state` call for `no_worker_process`) — Track per-round consecutive `no_worker_process` count; when count reaches 3, invalidate canary cache.
- `EDIT: .agents/scripts/pulse-wrapper.sh` (in the deterministic dispatch loop, around `build_ranked_dispatch_candidates_json` consumer) — After each round, compute `no_worker_process` failure ratio; if >80%, set throttle flag for next round limiting batch size to 1. Clear flag and restore configured batch on first launch success.
- `EDIT: .agents/scripts/headless-runtime-helper.sh:2716` — No change needed; the cache file path is what we invalidate from pulse-wrapper.sh. (Read-only reference to confirm path.)

### Implementation Steps

#### Step 1: Wire global circuit breaker into launch recovery (gated)

In `recover_failed_launch_state()` at `pulse-wrapper.sh:9356`, after the existing `fast_fail_record` call, conditionally invoke the global circuit breaker — but only for failures that indicate the runtime itself is broken, not in-execution stalls:

```bash
# Existing line 9356:
fast_fail_record "$issue_number" "$repo_slug" "$failure_reason" "anthropic" "$crash_type" || true

# NEW: Wire global circuit breaker for launch-class failures only.
# Stale timeouts and in-execution failures have their own backoff and should
# not trip a global halt. Only true launch failures (worker never appeared,
# CLI usage error) signal systemic runtime breakage.
case "$failure_reason" in
    no_worker_process | cli_usage_output)
        local cb_helper="${SCRIPT_DIR}/circuit-breaker-helper.sh"
        if [[ -x "$cb_helper" ]]; then
            "$cb_helper" record-failure "${repo_slug}#${issue_number}" "$failure_reason" >/dev/null 2>&1 || true
        fi
        ;;
esac
```

The breaker's existing cooldown (`SUPERVISOR_CIRCUIT_BREAKER_COOLDOWN_SECS=1800`) and threshold (`SUPERVISOR_CIRCUIT_BREAKER_THRESHOLD=3`) handle reset semantics — NEVER reset on launch success. Recovery happens via `record-success` on PR merge / issue close (already wired in supervisor).

#### Step 2: Per-round canary cache invalidation on consecutive failures

The dispatch loop processes ranked candidates per round. Track `no_worker_process` failures within the round; on the 3rd consecutive failure, invalidate the canary cache so the next dispatch (this round or next) re-runs the canary against the live runtime:

```bash
# In the dispatch round loop, near the recover_failed_launch_state call site
# (around line 10243). Add a per-round counter:
local _round_no_worker_count=0  # Reset at round start

# After recover_failed_launch_state for no_worker_process:
recover_failed_launch_state "$issue_number" "$repo_slug" "no_worker_process"
_round_no_worker_count=$((_round_no_worker_count + 1))

if [[ "$_round_no_worker_count" -ge 3 ]]; then
    # Invalidate canary cache so next dispatch re-tests the runtime.
    # Path matches headless-runtime-helper.sh:2716 (${STATE_DIR}/canary-last-pass).
    local _canary_cache="${STATE_DIR:-${HOME}/.aidevops/.agent-workspace}/canary-last-pass"
    if [[ -f "$_canary_cache" ]]; then
        rm -f "$_canary_cache"
        echo "[pulse-wrapper] Canary cache invalidated after 3 consecutive no_worker_process failures in round" >>"$LOGFILE"
    fi
    _round_no_worker_count=0  # Reset to avoid repeated invalidation
fi

# Reset on any successful launch within the round:
# (in the success branch of _validate_worker_launch / launch confirmation)
_round_no_worker_count=0
```

The exact location of `STATE_DIR` for the canary cache is owned by `headless-runtime-helper.sh:2716`. The implementation must read the same value (or source it) — do not hardcode a different path.

#### Step 3: Adaptive batch-size throttling

Track per-round outcomes; if >80% of dispatches in a round end in `no_worker_process`, set a flag that limits the next round's effective batch size to 1. On the **first successful launch** in throttled mode, clear the flag:

```bash
# Per-round counters at dispatch loop start:
local _round_dispatched=0
local _round_no_worker_failures=0

# Increment _round_dispatched on each dispatch attempt.
# Increment _round_no_worker_failures on each no_worker_process failure.
# Track in-flight throttle state in a small state file:
#   ${STATE_DIR}/dispatch-throttle  (contents: "1" = throttled, absent = normal)

# At round end:
if [[ "$_round_dispatched" -gt 0 ]]; then
    local ratio_pct=$((_round_no_worker_failures * 100 / _round_dispatched))
    if [[ "$ratio_pct" -gt 80 ]]; then
        echo "1" > "${STATE_DIR}/dispatch-throttle"
        echo "[pulse-wrapper] Dispatch throttle ENGAGED: ${ratio_pct}% no_worker_process in last round (${_round_no_worker_failures}/${_round_dispatched}) — next round limited to batch=1" >>"$LOGFILE"
    fi
fi

# At round start, before computing effective batch size:
local _effective_batch="$PULSE_RUNNABLE_ISSUE_LIMIT"  # or wherever batch size lives
if [[ -f "${STATE_DIR}/dispatch-throttle" ]]; then
    _effective_batch=1
fi

# In the launch-success path (after _validate_worker_launch returns 0):
if [[ -f "${STATE_DIR}/dispatch-throttle" ]]; then
    rm -f "${STATE_DIR}/dispatch-throttle"
    echo "[pulse-wrapper] Dispatch throttle CLEARED: launch success in throttled mode — restoring full batch=${PULSE_RUNNABLE_ISSUE_LIMIT}" >>"$LOGFILE"
fi
```

**Critical:** the throttle MUST clear on the first launch success, not after N successes. A single recovery proves the runtime is back; staying throttled wastes recovery time. The existing fast-fail counters will catch any individual issue that's broken in its own way.

### Verification

```bash
# 1. Shellcheck both modified files
shellcheck .agents/scripts/pulse-wrapper.sh
shellcheck .agents/scripts/headless-runtime-helper.sh

# 2. Verify the global breaker is invoked from launch recovery
grep -A3 "fast_fail_record \"\$issue_number\" \"\$repo_slug\" \"\$failure_reason\"" .agents/scripts/pulse-wrapper.sh

# 3. Verify canary cache path matches between caller and owner
grep -n "canary-last-pass" .agents/scripts/pulse-wrapper.sh .agents/scripts/headless-runtime-helper.sh

# 4. Verify throttle clears on launch success (not after N successes)
grep -B2 -A4 "dispatch-throttle" .agents/scripts/pulse-wrapper.sh | grep -c "rm -f"

# 5. Manual test: simulate by stubbing the runtime
#    a. Touch ${STATE_DIR}/canary-last-pass with current epoch (simulate stale-pass cache)
#    b. Run pulse with a stub OPENCODE_BIN that always fails to spawn workers
#    c. Verify canary cache deleted after 3 no_worker_process failures
#    d. Verify circuit-breaker-helper.sh status shows tripped after 3 record-failure calls
#    e. Verify dispatch-throttle file present after a >80% failure round
#    f. Stub a successful launch and verify throttle clears on first success
```

## Acceptance Criteria

- [ ] `recover_failed_launch_state` calls `circuit-breaker-helper.sh record-failure` for `no_worker_process` and `cli_usage_output` failures only — NOT for `stale_timeout` or other in-execution failures
  ```yaml
  verify:
    method: codebase
    pattern: "no_worker_process \\| cli_usage_output"
    path: ".agents/scripts/pulse-wrapper.sh"
  ```
- [ ] Canary cache (`${STATE_DIR}/canary-last-pass`) is deleted after 3 consecutive `no_worker_process` failures within a single dispatch round
  ```yaml
  verify:
    method: codebase
    pattern: "canary-last-pass"
    path: ".agents/scripts/pulse-wrapper.sh"
  ```
- [ ] Per-round consecutive `no_worker_process` counter resets to 0 on any successful launch
  ```yaml
  verify:
    method: codebase
    pattern: "_round_no_worker_count=0"
    path: ".agents/scripts/pulse-wrapper.sh"
  ```
- [ ] Dispatch throttle engages when round failure ratio exceeds 80% — limits next round to batch=1
  ```yaml
  verify:
    method: codebase
    pattern: "dispatch-throttle"
    path: ".agents/scripts/pulse-wrapper.sh"
  ```
- [ ] Dispatch throttle clears on the FIRST successful launch (not after N successes) and restores configured batch size
  ```yaml
  verify:
    method: bash
    run: "grep -A8 'dispatch-throttle' .agents/scripts/pulse-wrapper.sh | grep -q 'rm -f.*dispatch-throttle'"
  ```
- [ ] Existing per-issue fast-fail counter (`fast_fail_record`) behaviour is unchanged — no resets on launch, no new threshold logic
  ```yaml
  verify:
    method: codebase
    pattern: "Launch confirmed — do NOT reset fast-fail counter here"
    path: ".agents/scripts/pulse-wrapper.sh"
  ```
- [ ] `shellcheck` clean on both modified files
  ```yaml
  verify:
    method: bash
    run: "shellcheck .agents/scripts/pulse-wrapper.sh .agents/scripts/headless-runtime-helper.sh"
  ```

## Context & Decisions

- **Why this approach over GH#18347's proposal:** The proposed new fast-fail counter would auto-reset on launch success, contradicting the explicit lesson at `pulse-wrapper.sh:10231-10236` (GH#2076, GH#17378). It would also use a fixed threshold that doesn't scale with variable batch sizes. This approach reuses the existing global breaker (which already has correct reset semantics) and adds two complementary signals (cache invalidation, soft throttling) that preserve per-issue progress.
- **Why gate the breaker to launch-class failures:** `stale_timeout` and other in-execution failures already have working backoff via the per-issue fast-fail counter. Tripping the global breaker on those would block healthy issues that are simply slow. Only `no_worker_process` and `cli_usage_output` indicate systemic runtime breakage.
- **Why threshold=3 for cache invalidation:** Single failures can be transient (resource pressure, model warm-up). Two could be coincidence. Three within a single round strongly suggests the cached "canary passed" signal is stale. Three is also the existing breaker's default threshold, keeping the mental model consistent.
- **Why throttle clears on first success (not N successes):** Staying throttled after recovery wastes the recovery window — the goal is to LIMIT waste during breakage, not to enforce conservative dispatch after recovery. The per-issue fast-fail counters are sufficient to catch any individual issue that's broken in its own way.
- **Non-goals:** Replacing or modifying the per-issue fast-fail counter (`fast_fail_record` / t1888). Adding new state files beyond the throttle flag. Changing canary cache TTL (the invalidation triggers on signal, not on time).

## Relevant Files

- `.agents/scripts/pulse-wrapper.sh:9282` — `recover_failed_launch_state()` definition
- `.agents/scripts/pulse-wrapper.sh:9356` — `fast_fail_record` call (insertion point for breaker call)
- `.agents/scripts/pulse-wrapper.sh:10231-10236` — Documented invariant: never reset fast-fail on launch (GH#2076)
- `.agents/scripts/pulse-wrapper.sh:10243` — `recover_failed_launch_state` call for `no_worker_process`
- `.agents/scripts/headless-runtime-helper.sh:2714-2783` — `_run_canary_test()` and cache file location
- `.agents/scripts/headless-runtime-helper.sh:2678` — `CANARY_CACHE_TTL_SECONDS` default (1800)
- `.agents/scripts/circuit-breaker-helper.sh` — Existing global breaker (t1331); commands: `record-failure`, `record-success`, `check`, `status`, `reset`

## Dependencies

- **Blocked by:** none — all referenced infrastructure already exists
- **Blocks:** GH#18347 — once this lands, GH#18347 should be closed as fixed-by-alternative
- **External:** none

## Estimate Breakdown

| Phase | Time | Notes |
|-------|------|-------|
| Research/read | 20m | Re-read fast_fail_record state, dispatch loop structure, breaker API |
| Implementation | 1.5h | 3 distinct change sites in pulse-wrapper.sh; gating logic, ratio computation, throttle flag |
| Testing | 40m | Stubbed runtime simulation for cache invalidation, breaker trip, throttle engage/clear |
| **Total** | **2.5h** | |
