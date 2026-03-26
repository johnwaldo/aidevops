---
description: Headless dispatch patterns for parallel AI agent execution via OpenCode
mode: subagent
tools:
  read: true
  write: false
  edit: false
  bash: true
  glob: true
  grep: true
  webfetch: true
  task: true
---

# Headless Dispatch

<!-- AI-CONTEXT-START -->

## Quick Reference

- **One-shot**: `opencode run "prompt"` | **Warm server**: `opencode run --attach http://localhost:4096 "prompt"`
- **Server**: `opencode serve [--port 4096]` | **SDK**: `npm install @opencode-ai/sdk`
- **Runners**: `runner-helper.sh [create|run|status|list|stop|destroy]` → `~/.aidevops/.agent-workspace/runners/`

**Use for**: parallel tasks, scheduled/cron AI work, CI/CD, chat-triggered dispatch, background tasks. **Don't use for**: interactive dev (use TUI), frequent human-in-the-loop.

> **Never use bare `opencode run` for dispatch** — skips lifecycle reinforcement (GH#5096). Always use `headless-runtime-helper.sh run`.

<!-- AI-CONTEXT-END -->

## Dispatch Methods

### CLI

```bash
opencode run "Review src/auth.ts for security issues"
opencode run -m anthropic/claude-sonnet-4-6 "Generate unit tests for src/utils/"
opencode run --format json "List all exported functions in src/"
opencode run -f ./schema.sql "Generate types from this schema"
opencode run -c "Continue where we left off"    # resume last session
opencode run -s ses_abc123 "Add error handling"  # resume by ID
```

### Warm Server

```bash
opencode serve --port 4096                                       # Terminal 1
opencode run --attach http://localhost:4096 "Task 1"             # Terminal 2+
```

### SDK (TypeScript)

```typescript
import { createOpencode } from "@opencode-ai/sdk"
const { client, server } = await createOpencode({
  port: 4096, config: { model: "anthropic/claude-sonnet-4-6" },
})
// Connect to existing: createOpencodeClient({ baseUrl: "http://localhost:4096" })
```

### HTTP API

See `tools/ai-assistants/opencode-server.md` for full reference. Key: `POST /session` → `POST /session/$ID/message`. Async: `POST .../prompt_async` (204). SSE: `GET /event`. Fork: `POST /session/$ID/fork`.

## Parallel Execution

**Stagger manual launches by 30-60s** to avoid thundering herd. Pulse supervisor handles staggering automatically.

```bash
HELPER="$(aidevops config get paths.agents_dir | sed 's|~|'"$HOME"'|')/scripts/headless-runtime-helper.sh"
for issue in 42 43 44 45; do
  $HELPER run --role worker --session-key "issue-${issue}" \
    --dir ~/Git/myproject --title "Issue #${issue}" \
    --prompt "/full-loop Implement issue #${issue}" &
  sleep 30
done
```

**Worker monitoring**: `worker-watchdog.sh --status` | `--install`.

### Parallel vs Sequential

| Scenario | Pattern |
|----------|---------|
| PR review (security + quality + style) | Parallel — independent read-only |
| Bug fix + tests | Sequential — tests depend on fix |
| Multi-page SEO audit | Parallel — each page independent |
| Refactor + update docs | Sequential — docs depend on refactored code |
| Decomposed subtasks | Batch via `batch-strategy-helper.sh` |

**Batch**: `depth-first` (default) or `breadth-first`. `batch-strategy-helper.sh next-batch --strategy depth-first --tasks "$JSON" --concurrency "$SLOTS"` respects `blocked_by:` edges.

## Runners

Named, persistent agent instances. Each gets its own `AGENTS.md` (personality, rules, output format), namespaced memory (`memory-helper.sh --namespace "runner-name"`), and mailbox (`mail-helper.sh send --to/--from`).

```bash
runner-helper.sh create code-reviewer --description "Reviews code" --model anthropic/claude-sonnet-4-6
runner-helper.sh run code-reviewer "Review src/auth/ for vulnerabilities"
runner-helper.sh status|list|destroy code-reviewer
```

## Custom Agents

Agents defined in `.opencode/agents/<name>.md` with YAML frontmatter (`description`, `mode`, `model`, `temperature`, `tools`, `permission`). Example: `opencode run --agent security-reviewer "Audit the auth module"`. See `opencode.json` for JSON-based agent config.

## Model Provider Flexibility

`opencode auth login` for setup. Override per dispatch: `opencode run -m openrouter/anthropic/claude-sonnet-4-6 "Task"`. `SUPERVISOR_PREFER_OAUTH=true` (default) routes Anthropic requests through Claude CLI when OAuth available (zero marginal cost). Override: `export SUPERVISOR_CLI=opencode`.

## Security

1. **Network**: `--hostname 127.0.0.1` (default) | `OPENCODE_SERVER_PASSWORD` for network exposure
2. **Permissions**: `OPENCODE_PERMISSION='{"*":"allow"}'` for CI/CD
3. **Credentials**: Never pass secrets in prompts — use env vars. Delete sessions after use.
4. **Scoped tokens** (t1412.2): `worker-token-helper.sh create --repo owner/repo --ttl 3600` → `GH_TOKEN` → worker → `worker-token-helper.sh revoke`. Permissions: `contents:write`, `pull_requests:write`, `issues:write`. Disable: `WORKER_SCOPED_TOKENS=false`.
5. **Worker sandbox** (t1412.1): Fake HOME — `.gitconfig`, `GH_TOKEN`, `.aidevops/` symlink only. No `~/.ssh/`, gopass, cloud tokens. `worker-sandbox-helper.sh create <task_id>` → auto-clean.
6. **Network tiering** (t1412.3): Tier 5 denied, Tier 4 flagged. `configs/network-tiers.conf` / `scripts/network-tier-helper.sh`.

## Worker Uncertainty Framework

**Proceed**: can infer from context, affects only task scope, multiple valid approaches (pick simplest), style ambiguity, minor adjacent issues (note in PR body).

**Exit BLOCKED**: wrong answer = irreversible damage, cross-task architectural decision, task contradicts codebase, breaks public API, task appears done/obsolete, missing deps/credentials, data loss risk, multiple interpretations with very different outcomes.

Example: `BLOCKED: Task says 'update the auth endpoint' but there are 3 (JWT, OAuth, API key). Need clarification.`

## Lineage Context for Subtask Workers (t1408)

When dispatching subtasks (dot-notation IDs), append a lineage block to `--prompt` to prevent scope drift:

```text
TASK LINEAGE:
  0. [parent] Build a CRM (t1408)
    1. Contact management (t1408.1)
    2. Deal pipeline (t1408.2)  <-- THIS TASK
    3. Email integration (t1408.3)
LINEAGE RULES: Focus ONLY on your task. Stubs for cross-sibling deps. Exit BLOCKED if blocked by sibling.
```

Assemble: `PARENT_ID="${TASK_ID%.*}"` + grep siblings from TODO.md.

## Task Decomposition (t1408.2)

Tasks are **atomic** (dispatch directly) or **composite** (split into 2-5 subtasks). `task-decompose-helper.sh classify|decompose|has-subtasks`. Interactive: show tree, ask Y/n/edit → create child TODOs → dispatch leaves. Pulse: auto-proceed (depth limit: 3). **"When in doubt, atomic."**

## Worker Efficiency Protocol

1. **TodoWrite** — 3-7 subtasks at start. Last: "Push and create PR". Survives compaction.
2. **Commit early** — per subtask. After first: `git push -u origin HEAD && gh pr create --draft`.
3. **ShellCheck** — Before push, if `.sh` changed: `shellcheck -x -S warning` and fix.
4. **Research offloading** — Task sub-agents for 500+ line files.
5. **Parallel sub-work** — Task tool for independent ops. Sequential for same-file writes, dependent steps, git ops.
6. **Checkpoint** — `session-checkpoint-helper.sh save` per subtask.
7. **Fail fast** — Verify assumptions before coding. Exit BLOCKED after one failed retry.

## CI/CD Integration

```yaml
name: AI Code Review
on: { pull_request: { types: [opened, synchronize] } }
jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: curl -fsSL https://opencode.ai/install | bash
      - run: opencode run --format json "Review PR changes for security and quality" > review.md
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          OPENCODE_PERMISSION: '{"*":"allow"}'
```

## Related

- `tools/ai-assistants/opencode-server.md`, `tools/ai-assistants/overview.md`, `tools/ai-assistants/runners/`
- `scripts/runner-helper.sh`, `scripts/cron-dispatch.sh`, `scripts/cron-helper.sh`
- `scripts/matrix-dispatch-helper.sh`, `services/communications/matrix-bot.md`
- `scripts/commands/pulse.md`, `scripts/worker-token-helper.sh`, `scripts/network-tier-helper.sh`
- `tools/security/prompt-injection-defender.md`, `memory/README.md`
