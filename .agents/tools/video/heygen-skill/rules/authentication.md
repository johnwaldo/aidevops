---
name: authentication
description: API key setup, X-Api-Key header, and authentication patterns for HeyGen
metadata:
  tags: authentication, api-key, headers, security
---

# HeyGen Authentication

All HeyGen API requests require `X-Api-Key` header authentication.

## Setup

1. Log in at https://app.heygen.com → Settings > API → copy your key
2. Store as an environment variable — never hardcode:

```bash
export HEYGEN_API_KEY="your-api-key-here"
```

## Making Requests

### curl

```bash
curl -X GET "https://api.heygen.com/v2/avatars" \
  -H "X-Api-Key: $HEYGEN_API_KEY"
```

### TypeScript (fetch)

```typescript
const response = await fetch("https://api.heygen.com/v2/avatars", {
  headers: { "X-Api-Key": process.env.HEYGEN_API_KEY! },
});
const { data } = await response.json();
```

### Python

```python
import os, requests

data = requests.get(
    "https://api.heygen.com/v2/avatars",
    headers={"X-Api-Key": os.environ["HEYGEN_API_KEY"]}
).json()["data"]
```

## Response Format

All responses follow:

```typescript
interface ApiResponse<T> {
  error: null | string;
  data: T;
}
```

Check `json.error` before using `json.data`. Throw on non-null error or non-2xx status.

## Error Handling

| Status | Error | Cause |
|--------|-------|-------|
| 401 | Invalid API key | Key missing or incorrect |
| 403 | Forbidden | Key lacks required permissions |
| 429 | Rate limit exceeded | Too many requests — use exponential backoff |

## Rate Limiting

- Standard limits apply per API key
- Video generation endpoints have stricter limits
- On 429: retry with exponential backoff (`2^attempt * 1000ms`, max 3 retries)

## Security

- **Never expose keys in client-side code** — always call from a backend server
- **Use environment variables** — never hardcode keys in source
- **Rotate keys periodically** — generate new keys in the HeyGen dashboard
- **Monitor usage** — check the dashboard for unusual activity
