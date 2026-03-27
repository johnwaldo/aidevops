# Workerd Patterns

## Multi-Service Architecture

```capnp
const config :Workerd.Config = (
  services = [
    (name = "frontend", worker = (
      modules = [(name = "index.js", esModule = embed "frontend/index.js")],
      compatibilityDate = "2024-01-15",
      bindings = [(name = "API", service = "api")]
    )),
    (name = "api", worker = (
      modules = [(name = "index.js", esModule = embed "api/index.js")],
      compatibilityDate = "2024-01-15",
      bindings = [
        (name = "DB", service = "postgres"),
        (name = "CACHE", kvNamespace = "kv"),
      ]
    )),
    (name = "postgres", external = (address = "db.internal:5432", http = ())),
    (name = "kv", disk = (path = "/var/kv", writable = true)),
  ],
  sockets = [(name = "http", address = "*:8080", http = (), service = "frontend")]
);
```

**Reverse proxy variant:** use `serviceWorkerScript = embed "proxy.js"` instead of `modules`; bind backend via `(name = "BACKEND", service = "backend")`.

## Durable Objects

Add to any worker's config — requires `durableObjectNamespaces`, a binding, and storage:

```capnp
bindings = [(name = "ROOMS", durableObjectNamespace = "Room")],
durableObjectNamespaces = [(className = "Room", uniqueKey = "v1")],
durableObjectStorage = (localDisk = "/var/do")
```

## Dev vs Prod (inherit pattern)

```capnp
const devWorker :Workerd.Worker = (
  modules = [(name = "index.js", esModule = embed "src/index.js")],
  compatibilityDate = "2024-01-15",
  bindings = [(name = "API_URL", text = "http://localhost:3000"), (name = "DEBUG", text = "true")]
);
const prodWorker :Workerd.Worker = (
  inherit = "dev-service",
  bindings = [(name = "API_URL", text = "https://api.prod.com"), (name = "DEBUG", text = "false")]
);
```

## Local Development

```bash
MINIFLARE_WORKERD_PATH="/path/to/workerd" wrangler dev   # via wrangler
workerd serve config.capnp --socket-addr http=*:3000 --verbose  # direct
```

Environment variables from host:

```capnp
bindings = [
  (name = "DATABASE_URL", fromEnvironment = "DATABASE_URL"),
  (name = "API_KEY", fromEnvironment = "API_KEY"),
]
```

## Testing

```bash
workerd test config.capnp                       # all tests
workerd test config.capnp --test-only=test.js   # single file
```

Test worker config — add test modules alongside source:

```capnp
modules = [
  (name = "index.js", esModule = embed "src/index.js"),
  (name = "test.js", esModule = embed "tests/test.js"),
]
```

## Production Deployment

### Systemd (socket-activated)

```ini
# /etc/systemd/system/workerd.service
[Unit]
Description=workerd runtime
After=network-online.target
Requires=workerd.socket
[Service]
Type=exec
ExecStart=/usr/bin/workerd serve /etc/workerd/config.capnp --socket-fd http=3
Restart=always
User=nobody
NoNewPrivileges=true
[Install]
WantedBy=multi-user.target
```

Pair with socket unit at `/etc/systemd/system/workerd.socket` (`ListenStream=0.0.0.0:80`, `WantedBy=sockets.target`).

### Docker

```dockerfile
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates
COPY workerd /usr/local/bin/
COPY config.capnp /etc/workerd/
COPY src/ /etc/workerd/src/
EXPOSE 8080
CMD ["workerd", "serve", "/etc/workerd/config.capnp"]
```

**Compiled binary:** `workerd compile config.capnp myConfig -o production-server && ./production-server`

## Best Practices

1. **ES modules** over service worker syntax
2. **Explicit bindings** -- no global namespace assumptions
3. **Type safety** -- define `Env` interfaces
4. **Service isolation** -- split concerns into separate services
5. **Pin compat date** in production after testing
6. **`ctx.waitUntil()`** for background tasks (analytics, logging)
7. **Try/catch in fetch handler** -- return 500 instead of crashing
8. **Configure resource limits** on caches/storage

## Common Handler Pattern

```javascript
export default {
  async fetch(request, env, ctx) {
    try {
      ctx.waitUntil(logToAnalytics(request, env));  // background, non-blocking
      return await handleRequest(request, env);
    } catch (error) {
      console.error("Request failed", error);
      return new Response("Internal Error", { status: 500 });
    }
  }
};
```

See [gotchas.md](./gotchas.md) for common errors.
