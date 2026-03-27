---
description: Crawl4AI MCP server integration setup
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

# Crawl4AI Integration Guide

<!-- AI-CONTEXT-START -->

## Quick Reference

- **Main guide**: `crawl4ai.md` (installation, Python API, Docker, MCP, troubleshooting)
- Install: `./.agents/scripts/crawl4ai-helper.sh install`
- Docker: `./.agents/scripts/crawl4ai-helper.sh docker-start`
- MCP setup: `./.agents/scripts/crawl4ai-helper.sh mcp-setup`
- Endpoints: API :11235, Dashboard /dashboard, Playground /playground
- Config: `configs/crawl4ai-config.json.txt`, `configs/mcp-templates/crawl4ai-mcp-config.json`
- Debug: `./.agents/scripts/crawl4ai-helper.sh status`, `docker logs crawl4ai`

<!-- AI-CONTEXT-END -->

This doc covers framework-specific integration patterns. For installation, core Python API, Docker deployment, MCP tools, browser engines, CapSolver, and troubleshooting, see `crawl4ai.md`.

## MCP Server Configuration

Add to your AI assistant's MCP config (Claude Desktop, etc.):

```json
{
  "mcpServers": {
    "crawl4ai": {
      "command": "npx",
      "args": ["crawl4ai-mcp-server@latest"],
      "env": {
        "CRAWL4AI_API_URL": "http://localhost:11235"
      }
    }
  }
}
```

**MCP tools**: `crawl_url`, `crawl_multiple`, `extract_structured`, `take_screenshot`, `generate_pdf`, `execute_javascript`.

## Job Queue and Webhooks

### Submit Async Crawl Job

```python
response = requests.post("http://localhost:11235/crawl/job", json={
    "urls": ["https://example.com"],
    "webhook_config": {
        "webhook_url": "https://your-app.com/webhook",
        "webhook_data_in_payload": True
    }
})
task_id = response.json()["task_id"]
```

### Webhook Handler

```python
@app.route('/webhook', methods=['POST'])
def handle_webhook():
    try:
        payload = request.get_json(silent=True)
        if payload is None:
            return {"error": "Invalid or missing JSON payload"}, 400
        if 'status' not in payload:
            return {"error": "Missing required field: status"}, 400
        if payload['status'] == 'completed':
            if 'data' not in payload:
                return {"error": "Missing required field: data"}, 400
            process_results(payload['data'])
        return {"ok": True}, 200
    except Exception as e:
        return {"error": str(e)}, 500
```

## Security Configuration

### Rate Limiting

```yaml
rate_limiting:
  enabled: true
  default_limit: "1000/minute"
  trusted_proxies: []
```

### Security Headers

```yaml
security:
  headers:
    x_content_type_options: "nosniff"
    x_frame_options: "DENY"
    content_security_policy: "default-src 'self'"
```

### Hook Security

- Never trust user-provided hook code
- Validate and sandbox hook execution
- Use timeouts to prevent infinite loops
- Audit hook code before deployment

## Proxy Configuration

```python
from crawl4ai import BrowserConfig

browser_config = BrowserConfig(
    proxy={
        "server": "http://proxy.example.com:8080",
        "username": "user",
        "password": "pass"
    }
)
```

## Environment Variables

```bash
OPENAI_API_KEY=sk-your-key
ANTHROPIC_API_KEY=your-anthropic-key
LLM_PROVIDER=openai/gpt-4o-mini
LLM_TEMPERATURE=0.7
CRAWL4AI_MAX_PAGES=50
CRAWL4AI_TIMEOUT=60
CRAWL4AI_DEFAULT_FORMAT=markdown
```

## Monitoring Endpoints

```bash
curl http://localhost:11235/health     # Health check
curl http://localhost:11235/metrics    # Prometheus metrics
curl http://localhost:11235/schema     # API schema
```

Dashboard features: system metrics, browser pool management, request analytics, resource monitoring.

## Resources

- **Main guide**: `crawl4ai.md` (Python API, Docker, MCP tools, troubleshooting)
- **Usage patterns**: `crawl4ai-usage.md`
- **Links and references**: `crawl4ai-resources.md`
- **Helper script**: `.agents/scripts/crawl4ai-helper.sh`
- **Config template**: `configs/crawl4ai-config.json.txt`
- **MCP config**: `configs/mcp-templates/crawl4ai-mcp-config.json`
- **Official docs**: https://docs.crawl4ai.com/
- **GitHub**: https://github.com/unclecode/crawl4ai
