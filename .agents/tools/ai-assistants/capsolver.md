---
description: CapSolver CAPTCHA solving with Crawl4AI
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

# CapSolver + Crawl4AI Integration Guide

<!-- AI-CONTEXT-START -->

## Quick Reference

- **Setup**: `./.agents/scripts/crawl4ai-helper.sh capsolver-setup`
- **API key**: `export CAPSOLVER_API_KEY="CAP-xxxxx"` from dashboard.capsolver.com
- **Crawl**: `./.agents/scripts/crawl4ai-helper.sh captcha-crawl URL captcha_type site_key`
- **Config**: `configs/capsolver-config.json`, `configs/capsolver-example.py`
- **Docs**: <https://docs.capsolver.com/>, [API ref](https://docs.capsolver.com/guide/api-how-to-use/)
- **Partnership**: <https://www.capsolver.com/blog/Partners/crawl4ai-capsolver/>

<!-- AI-CONTEXT-END -->

## Supported CAPTCHA Types

| Type | Task Type | Cost/1k | Speed |
|------|-----------|---------|-------|
| reCAPTCHA v2 | `ReCaptchaV2TaskProxyLess` | $0.50 | <9s |
| reCAPTCHA v3 | `ReCaptchaV3TaskProxyLess` | $0.50 | <3s |
| reCAPTCHA v2 Enterprise | `ReCaptchaV2EnterpriseTaskProxyLess` | $1.00 | <9s |
| reCAPTCHA v3 Enterprise | `ReCaptchaV3EnterpriseTaskProxyLess` | $3.00 | <3s |
| Cloudflare Turnstile | `AntiTurnstileTaskProxyLess` | $3.00 | <3s |
| Cloudflare Challenge | `AntiCloudflareTask` (proxy required) | Contact | <10s |
| AWS WAF | `AntiAwsWafTask` | Contact | <5s |
| GeeTest v3/v4 | `GeeTestTaskProxyLess` | $0.50 | <5s |
| Image-to-Text OCR | `ImageToTextTask` | $0.40 | <1s |

## Setup

```bash
# Install Crawl4AI with CapSolver support
./.agents/scripts/crawl4ai-helper.sh install
./.agents/scripts/crawl4ai-helper.sh docker-setup
./.agents/scripts/crawl4ai-helper.sh capsolver-setup

# Set API key (get from https://dashboard.capsolver.com/dashboard/overview)
export CAPSOLVER_API_KEY="CAP-xxxxxxxxxxxxxxxxxxxxx"
```

**Browser extension alternative**: Install [CapSolver Chrome Extension](https://chrome.google.com/webstore/detail/capsolver/pgojnojmmhpofjgdmaebadhbocahppod), configure API key, enable auto-solve, then run Crawl4AI with extension-enabled browser profile.

## CLI Usage

```bash
# reCAPTCHA v2
./.agents/scripts/crawl4ai-helper.sh captcha-crawl \
  https://recaptcha-demo.appspot.com/recaptcha-v2-checkbox.php \
  recaptcha_v2 6LfW6wATAAAAAHLqO2pb8bDBahxlMxNdo9g947u9

# Cloudflare Turnstile
./.agents/scripts/crawl4ai-helper.sh captcha-crawl \
  https://clifford.io/demo/cloudflare-turnstile \
  turnstile 0x4AAAAAAAGlwMzq_9z6S9Mh

# AWS WAF
./.agents/scripts/crawl4ai-helper.sh captcha-crawl \
  https://nft.porsche.com/onboarding@6 aws_waf
```

## Python API

### reCAPTCHA v2 Example

```python
import asyncio
import capsolver
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

capsolver.api_key = "CAP-xxxxxxxxxxxxxxxxxxxxx"

async def solve_recaptcha_v2():
    site_url = "https://recaptcha-demo.appspot.com/recaptcha-v2-checkbox.php"
    site_key = "6LfW6wATAAAAAHLqO2pb8bDBahxlMxNdo9g947u9"

    solution = capsolver.solve({
        "type": "ReCaptchaV2TaskProxyLess",
        "websiteURL": site_url,
        "websiteKey": site_key,
    })
    token = solution["gRecaptchaResponse"]

    browser_config = BrowserConfig(verbose=True, headless=False)
    async with AsyncWebCrawler(config=browser_config) as crawler:
        js_code = f"""
            document.getElementById('g-recaptcha-response').value = '{token}';
            document.querySelector('button[type="submit"]').click();
        """
        config = CrawlerRunConfig(js_code=js_code, js_only=True)
        result = await crawler.arun(url=site_url, config=config)
        return result.markdown
```

### Turnstile Variant

Same pattern — change task type and token field:

```python
solution = capsolver.solve({
    "type": "AntiTurnstileTaskProxyLess",
    "websiteURL": site_url,
    "websiteKey": site_key,
})
token = solution["token"]  # not gRecaptchaResponse
# Inject: input[name="cf-turnstile-response"]
```

### Cloudflare Challenge (Proxy Required)

```python
solution = capsolver.solve({
    "type": "AntiCloudflareTask",
    "websiteURL": site_url,
    "proxy": "proxy.example.com:8080:username:password",
})
```

### Auto-Detection via Extension

```python
browser_config = BrowserConfig(
    use_persistent_context=True,
    user_data_dir="/path/to/profile/with/extension"
)
```

### Balance Check

```python
balance = capsolver.balance()
print(f"Remaining balance: ${balance}")
```

## Error Handling

```python
try:
    solution = capsolver.solve(task_config)
    if solution.get("errorId") == 0:
        token = solution["solution"]["gRecaptchaResponse"]
    else:
        print(f"CAPTCHA solving failed: {solution.get('errorDescription')}")
except Exception as e:
    print(f"Error: {e}")
```

**Common failures**: Invalid API key (verify format + account status), insufficient balance, wrong site key for target, token injection timing (adjust wait conditions for dynamic content).

## Best Practices

- **Rate limiting**: Respect site limits even with CAPTCHA solving; use delays between requests
- **Cost**: Package deals save up to 60%; choose v2 over Enterprise when possible
- **Fingerprinting**: Match browser fingerprints for Cloudflare; use consistent User-Agent; maintain session cookies
- **Monitoring**: Track balance and success rates via CapSolver dashboard

## Troubleshooting

```bash
# Check integration status
./.agents/scripts/crawl4ai-helper.sh status

# Test API key
curl -X POST https://api.capsolver.com/getBalance \
  -H "Content-Type: application/json" \
  -d '{"clientKey":"CAP-xxxxxxxxxxxxxxxxxxxxx"}'

# Check Crawl4AI Docker
docker logs crawl4ai --tail 20
```

## Framework Integration

| Resource | Path |
|----------|------|
| Helper script | `.agents/scripts/crawl4ai-helper.sh` |
| Config | `configs/capsolver-config.json` |
| Example | `configs/capsolver-example.py` |
| MCP template | `configs/mcp-templates/crawl4ai-mcp-config.json` |
