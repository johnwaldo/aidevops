---
description: Cron job management for scheduled AI agent dispatch
mode: subagent
tools:
  read: true
  write: true
  edit: true
  bash: true
  glob: false
  grep: true
  webfetch: false
  task: true
---

# @cron - Scheduled Task Management

<!-- AI-CONTEXT-START -->

## Quick Reference

- **List jobs**: `cron-helper.sh list`
- **Add job**: `cron-helper.sh add --schedule "0 9 * * *" --task "Run daily report"`
- **Remove job**: `cron-helper.sh remove <job-id>`
- **Pause/Resume**: `cron-helper.sh pause|resume <job-id>`
- **Logs**: `cron-helper.sh logs [--job <id>] [--tail 50] [--follow] [--since DATE]`
- **Debug**: `cron-helper.sh debug <job-id>`
- **Status**: `cron-helper.sh status`
- **Config**: `~/.config/aidevops/cron-jobs.json`

<!-- AI-CONTEXT-END -->

Agent for managing cron jobs that dispatch AI agents via OpenCode server API.

## Architecture

crontab -> `cron-dispatch.sh <job-id>` -> OpenCode Server API -> AI Session -> Results (optional: `mail-helper.sh`)

**Storage:**

- `~/.config/aidevops/cron-jobs.json` — job definitions
- `~/.aidevops/.agent-workspace/cron/` — execution logs
- `~/.aidevops/.agent-workspace/mail/` — result delivery

## Commands

### Add Job

```bash
cron-helper.sh add \
  --schedule "0 9 * * *" \
  --task "Generate daily SEO report for example.com" \
  --name "daily-seo-report" \
  --notify mail \
  --timeout 300
```

**Options:** `--schedule` (cron expr, required), `--task` (AI prompt, required), `--name` (optional, auto-generated), `--notify mail|none` (default: none), `--timeout` seconds (default: 600), `--workdir` (default: cwd), `--model` (default: from config), `--paused` (create paused).

### Remove Job

```bash
cron-helper.sh remove job-001          # with confirmation
cron-helper.sh remove job-001 --force  # skip confirmation
```

## Job Configuration

Jobs stored in `~/.config/aidevops/cron-jobs.json`:

```json
{
  "version": "1.0",
  "jobs": [
    {
      "id": "job-001",
      "name": "daily-seo-report",
      "schedule": "0 9 * * *",
      "task": "Generate daily SEO report for example.com using DataForSEO",
      "workdir": "/Users/me/projects/example-site",
      "timeout": 300,
      "notify": "mail",
      "model": "anthropic/claude-sonnet-4-6",
      "status": "active",
      "created": "2024-01-10T10:00:00Z",
      "lastRun": "2024-01-15T09:00:00Z",
      "lastStatus": "success"
    }
  ]
}
```

## Execution Flow

1. **crontab** calls `cron-dispatch.sh <job-id>`
2. **cron-dispatch.sh** loads config, checks server health, creates session via API, sends task, waits (with timeout), logs results, optionally notifies via mailbox

```bash
# Auto-managed crontab entry
0 9 * * * /Users/me/.aidevops/agents/scripts/cron-dispatch.sh job-001 >> /Users/me/.aidevops/.agent-workspace/cron/job-001.log 2>&1
```

## OpenCode Server Integration

The cron agent requires a running OpenCode server:

```bash
# Start (use launchd/systemd for persistence)
opencode serve --port 4096

# With authentication (recommended)
OPENCODE_SERVER_PASSWORD=your-secret opencode serve --port 4096
```

### Persistent Server Setup

**macOS:** Create `~/Library/LaunchAgents/com.aidevops.opencode-server.plist` with `ProgramArguments` pointing to `opencode serve --port 4096`, `RunAtLoad` and `KeepAlive` true, and `OPENCODE_SERVER_PASSWORD` in `EnvironmentVariables`. Load with `launchctl load ~/Library/LaunchAgents/com.aidevops.opencode-server.plist`.

**Linux:** Create `~/.config/systemd/user/opencode-server.service` with `ExecStart=/usr/local/bin/opencode serve --port 4096`, `Environment=OPENCODE_SERVER_PASSWORD=your-secret-here`, `Restart=always`. Enable with `systemctl --user enable --now opencode-server`.

## Use Cases

```bash
# Daily reports
cron-helper.sh add --schedule "0 9 * * *" --task "Generate daily SEO report. Check rankings, traffic, indexation. Save to ~/reports/seo-\$(date +%Y-%m-%d).md" --name "daily-seo-report" --notify mail

# Health checks (every 30 min)
cron-helper.sh add --schedule "*/30 * * * *" --task "Check deployment health: SSL, response times, error rates. Alert if issues." --name "health-check" --timeout 120

# Weekly maintenance
cron-helper.sh add --schedule "0 3 * * 0" --task "Prune old logs, consolidate memory, clean temp files. Report summary." --name "weekly-maintenance" --workdir "~/.aidevops"

# Content publishing (weekdays)
cron-helper.sh add --schedule "0 8 * * 1-5" --task "Check content calendar. Publish ready content to WordPress and social media." --name "content-publisher" --workdir "~/projects/blog"
```

## Notification via Mailbox

When `--notify mail` is set, results go to the inter-agent mailbox. Check with `mail-helper.sh check --type status_report`. Results include job ID/name, execution time, status, AI response summary, and errors.

## Troubleshooting

| Problem | Diagnostic |
|---------|-----------|
| Job not running | `crontab -l \| grep cron-dispatch` then `cron-helper.sh list` (check paused) then `pgrep cron` |
| Server issues | `curl http://localhost:4096/global/health` — check auth, view `/tmp/opencode-server.log` |
| Permission issues | `chmod +x ~/.aidevops/agents/scripts/cron-*.sh` — check `~/.aidevops/.agent-workspace/cron/` perms |

## Security

1. **HTTPS by default** — non-localhost hosts automatically use HTTPS
2. **Server authentication** — always use `OPENCODE_SERVER_PASSWORD` for network-exposed servers
3. **SSL verification** — enabled by default; `OPENCODE_INSECURE=1` only for self-signed certs
4. **Task validation** — jobs only execute pre-defined tasks from `cron-jobs.json`
5. **Timeout limits** — configurable per-job to prevent runaway sessions
6. **Log rotation** — old logs auto-pruned (configurable retention)
7. **Credential isolation** — tasks inherit environment from cron, not config files

### Remote Server Configuration

```bash
export OPENCODE_HOST="opencode.example.com"
export OPENCODE_PORT="4096"
export OPENCODE_SERVER_PASSWORD="your-secure-password"
# Optional for self-signed certs (not recommended): OPENCODE_INSECURE=1
cron-helper.sh status  # test connection
```

Protocol: `localhost`/`127.0.0.1`/`::1` use HTTP; all other hosts use HTTPS.

## Related

- `tools/ai-assistants/opencode-server.md` — OpenCode server API
- `mail-helper.sh` — inter-agent mailbox for notifications
- `memory-helper.sh` — cross-session memory for task context
- `workflows/ralph-loop.md` — iterative AI development patterns
