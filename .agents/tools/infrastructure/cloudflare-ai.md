---
description: "Cloudflare Workers AI — edge serverless inference, ~30 open-source models, global PoPs, wrangler CLI"
mode: subagent
tools:
  read: true
  write: false
  edit: false
  bash: true
  glob: false
  grep: true
  webfetch: true
  task: false
---

# Cloudflare Workers AI

<!-- AI-CONTEXT-START -->

## Quick Reference

- **API base**: `https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}` (REST) | Workers binding (in-Worker)
- **Auth**: Cloudflare API token with `Workers AI` permission | `Authorization: Bearer <token>` header
- **Creds**: `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` env vars
- **CLI**: `wrangler` — `npm install -g wrangler` | `wrangler ai models list`
- **Docs**: [Quickstart](https://developers.cloudflare.com/workers-ai/get-started/) | [Models](https://developers.cloudflare.com/workers-ai/models/) | [Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- **Dashboard**: [dash.cloudflare.com](https://dash.cloudflare.com) → AI → Workers AI

<!-- AI-CONTEXT-END -->

Edge serverless inference on Cloudflare's global network (300+ PoPs). Models run close to users with no cold starts. OpenAI-compatible REST API available; native Workers binding for in-Worker use.

**Best for**: edge inference integrated with Cloudflare Workers/Pages, low-latency global inference for small-to-mid models, Cloudflare-stack applications.
**Not for**: fine-tuning, custom model uploads (custom models via waitlist only), large models (>70B), privacy-critical TEE workloads (see `nearai.md`), batch inference.

## Pricing (March 2026)

- **Free tier**: 10,000 neurons/day (shared across all models)
- **Paid**: $0.011 per 1,000 neurons (neurons = compute units, not tokens — varies by model)
- No per-token pricing published; see [pricing docs](https://developers.cloudflare.com/workers-ai/platform/pricing/) for neuron costs per model

## Models

~30 open-source models across text generation, embeddings, image classification, speech recognition, and image generation. Key models: Llama 3.3 70B, Mistral 7B, Qwen 2.5, Gemma, Whisper, FLUX. Full catalog: https://developers.cloudflare.com/workers-ai/models/

## Usage

### REST API

```bash
curl "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

### Workers Binding (in-Worker)

```javascript
// wrangler.toml: [ai] binding = "AI"
export default {
  async fetch(request, env) {
    const response = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages: [{ role: "user", content: "Hello" }],
    });
    return Response.json(response);
  },
};
```

### OpenAI-Compatible Endpoint

Cloudflare provides an OpenAI-compatible endpoint for supported models. See [OpenAI compat docs](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/) for supported models and limitations — not all Workers AI models support this interface.

## Security

- Store credentials: `aidevops secret set CLOUDFLARE_API_TOKEN` and `aidevops secret set CLOUDFLARE_ACCOUNT_ID`
- Never expose tokens in logs or output
- Use scoped API tokens (Workers AI permission only) for CI/CD

## See Also

- `tools/infrastructure/fireworks.md` — managed inference + fine-tuning (more models, fine-tuning support)
- `tools/infrastructure/nearai.md` — TEE-backed private inference
- `tools/infrastructure/cloud-gpu.md` — raw GPU providers for self-managed inference
- `tools/deployment/hosting-comparison.md` — platform comparison including inference hosting
