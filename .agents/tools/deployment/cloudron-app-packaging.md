---
description: Package custom applications for Cloudron deployment
mode: subagent
tools:
  read: true
  write: true
  edit: true
  bash: true
  glob: true
  grep: true
  webfetch: true
  task: true
---

# Cloudron App Packaging Guide

<!-- AI-CONTEXT-START -->

## Quick Reference

- **Docs**: [docs.cloudron.io/packaging](https://docs.cloudron.io/packaging/tutorial/) | [CLI Reference](https://docs.cloudron.io/packaging/cli/) | [Publishing](https://docs.cloudron.io/packaging/publishing/)
- **Source Code**: [git.cloudron.io/packages](https://git.cloudron.io/packages) (200+ official app packages) | [By Technology](https://git.cloudron.io/explore/projects/topics)
- **Forum**: [forum.cloudron.io/category/96](https://forum.cloudron.io/category/96/app-packaging-development)
- **Base Image Tags**: https://hub.docker.com/r/cloudron/base/tags
- **Sub-docs**: [addons-ref.md](cloudron-app-packaging-skill/addons-ref.md) | [manifest-ref.md](cloudron-app-packaging-skill/manifest-ref.md) | [cloudron-git-reference.md](cloudron-git-reference.md)
- **Skill file**: [cloudron-app-packaging-skill.md](cloudron-app-packaging-skill.md) — Dockerfile patterns, start.sh conventions, manifest essentials, addons overview, stack-specific notes, debugging commands

**Golden Rules** (violations cause package failure):

1. `/app/code` READ-ONLY at runtime — write to `/app/data`
2. Run as `cloudron` user (UID 1000): `exec gosu cloudron:cloudron`
3. Use Cloudron addons (mysql, postgresql, redis) — never bundle databases
4. Disable built-in auto-updaters — Cloudron manages updates via image replacement
5. App receives HTTP — Cloudron's nginx terminates SSL

**File Structure**: `CloudronManifest.json`, `Dockerfile`, `start.sh`, `logo.png` (256x256).

**CLI Workflow**:

```bash
npm install -g cloudron
cloudron login my.cloudron.example && cloudron init
cloudron build && cloudron install --location testapp
cloudron build && cloudron update --app testapp  # iterate
cloudron logs -f --app testapp
cloudron exec --app testapp   # shell into container
cloudron debug --app testapp  # pause app, writable fs
```

<!-- AI-CONTEXT-END -->

## Pre-Packaging Assessment

Assess feasibility before writing code. Initial packaging is ~25% of total effort; the remaining 75% is SSO integration, upgrade path testing, backup correctness, and ongoing maintenance.

**Axis A: Structural Difficulty** (max 14) — score each 0-3:
A1. Process count (1 vs 5+) · A2. Data storage (addon vs exotic) · A3. Runtime (in base image vs compile-from-source) · A4. Message broker (none vs AMQP) · A5. Filesystem writes (0-3 vs 9+ symlinks) · A6. Authentication (native LDAP/OIDC vs browser wizard).
Thresholds: 0-2 Trivial · 3-4 Easy · 5-6 Medium · 7-9 Hard · **10+ Impractical**.

**Axis B: Compliance & Maintenance** (max 13) — score each 0-3:
B1. SSO quality · B2. Upstream stability · B3. Backup complexity · B4. Platform fit (HTTP vs raw TCP/UDP) · B5. Config drift (env vars vs self-modifying code).
Thresholds: 0-2 Low · 3-5 Moderate · 6-8 High · **9+ Very High — recommend against packaging**.

### Pre-Packaging Research

1. Fetch upstream `docker-compose.yml` — **most valuable artifact** (reveals true dependency graph), `Dockerfile`, dependency files, auth docs (search "LDAP", "OIDC", "SSO"), releases page.
2. **Forum search**: `https://forum.cloudron.io/search?term=APP_NAME&in=titles`
3. **App store**: `cloudron appstore search APP_NAME`
4. **Reference apps**: [cloudron-git-reference.md](cloudron-git-reference.md) for apps by technology.

## Base Image

**Always start from `cloudron/base:5.0.0`.** Never start from the upstream app's Docker image — monolithic upstream images bundle their own databases, reverse proxies, and init systems, causing multi-week packaging failures. Read the upstream `docker-compose.yml` to understand dependencies, then install the app on `cloudron/base` using its package manager.

**Multi-stage builds**: Only when compilation on `cloudron/base` is impractical. Build in the upstream image, then `COPY --from` artifacts into a final `cloudron/base` stage. **Alpine/musl warning**: Binaries compiled in Alpine (musl libc) will NOT run on `cloudron/base` (Ubuntu/glibc).

**Included**: Ubuntu 24.04, Node.js 24.x (+ 22 LTS), Python 3.12, PHP 8.3, Nginx 1.24, Apache 2.4, Supervisor 4.2, gosu 1.17, gcc 13.3, psql 16, mysql 8.0, redis-cli 7.4, mongosh 2.4. **NOT included** (install if needed): Ruby, Go, Java, Rust, pandoc, wkhtmltopdf.

## Key Patterns

Full manifest reference: [manifest-ref.md](cloudron-app-packaging-skill/manifest-ref.md). Addon env vars: [addons-ref.md](cloudron-app-packaging-skill/addons-ref.md). Dockerfile/start.sh patterns: [cloudron-app-packaging-skill.md](cloudron-app-packaging-skill.md).

- Read env vars fresh on every start (values can change across restarts). Run DB migrations on each start.
- `localstorage` addon is MANDATORY for persistent data. Health check path must return HTTP 200 unauthenticated.
- **Memory limits**: Static/PHP 128-256 MB · Node/Go/Rust 256-512 MB · PHP+workers/Python/Ruby 512-768 MB · Java/JVM 1024+ MB. In bytes: 256MB=268435456, 512MB=536870912, 1GB=1073741824.
- **TCP/UDP ports**: Declare in `tcpPorts` manifest field; values exposed as env vars. Apps must handle their own TLS.
- **9.1+ features**: `persistentDirs`, `backupCommand`/`restoreCommand`, SQLite backup via `"localstorage": { "sqlite": { "paths": ["/app/data/db/app.db"] } }`.
- **General env vars**: `CLOUDRON_APP_ORIGIN` (full URL), `CLOUDRON_APP_DOMAIN` (domain only), `CLOUDRON=1`.
- **Message broker**: No AMQP addon. Prefer Redis as broker (Celery/Bull support it natively via `CLOUDRON_REDIS_URL`). If AMQP required, install LavinMQ (~40 MB RAM, drop-in RabbitMQ replacement) and run as a Supervisor program under `/app/data/lavinmq`.

## Filesystem Permissions

| Path | State | Purpose |
|------|-------|---------|
| `/app/code` | READ-ONLY | Application code |
| `/app/data` | READ-WRITE | Persistent storage (backed up) |
| `/run` | READ-WRITE (wiped on restart) | Sockets, PIDs, sessions, caches |
| `/tmp` | READ-WRITE (wiped on restart) | Temporary files |

## Common Anti-Patterns

| Anti-pattern | Wrong | Correct |
|---|---|---|
| Starting from upstream image | `FROM someapp/monolith:latest` | `FROM cloudron/base:5.0.0` + install app |
| Writing to /app/code | Write to `/app/code/cache/` | Write to `/app/data/cache/` |
| Running as root | `node /app/code/server.js` | `exec gosu cloudron:cloudron node /app/code/server.js` |
| Missing exec | `gosu cloudron:cloudron node server.js` | `exec gosu cloudron:cloudron node server.js` |
| Non-idempotent start.sh | `cp config.json /app/data/` | `cp -n config.json /app/data/ 2>/dev/null \|\| true` |
| Hardcoded URLs | `"https://myapp.example.com"` | `process.env.CLOUDRON_APP_ORIGIN` |
| Bundling databases | `apt-get install -y postgresql` | Use Cloudron addons |
| Caching env vars | Store `process.env.CLOUDRON_MYSQL_HOST` at startup | Read fresh each time |

## Upgrade & Migration Handling

Track version in `/app/data/.app_version`; compare on start to run per-version migration blocks. Migrations MUST be idempotent — use framework migration tracking (Laravel, Django, Rails) or raw SQL with `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| App won't start | `cloudron logs --app testapp` / `cloudron debug --app testapp` |
| Permission denied | `chown -R cloudron:cloudron /app/data` — check for writes to `/app/code` |
| DB connection fails | Verify addon in manifest; `cloudron exec --app testapp` then `env \| grep CLOUDRON` |
| Health check fails | `curl -v http://localhost:8000/health` — verify app listens on httpPort |
| Memory exceeded | Increase `memoryLimit`; check for leaks; optimize worker counts |

## Validation Checklist

```text
[ ] Fresh install + restart (cloudron restart --app) succeed
[ ] Health check returns 200
[ ] File uploads persist across restarts
[ ] Database connections work; email works (if applicable)
[ ] Memory stays within limit
[ ] Upgrade from previous version works
[ ] Backup/restore cycle works
[ ] Auto-updater disabled; logs stream to stdout/stderr
```

## Publishing

Fork https://git.cloudron.io/cloudron/appstore, add your app directory with manifest and icon, submit a merge request. See: https://docs.cloudron.io/packaging/publishing/
