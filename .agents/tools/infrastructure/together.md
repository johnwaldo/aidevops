---
description: "Together AI — managed inference, fine-tuning (SFT/DPO/RL), GPU clusters, 100+ open-source models"
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

# Together AI

<!-- AI-CONTEXT-START -->

## Quick Reference

- **API base**: `https://api.together.xyz/v1` (OpenAI-compat)
- **Auth**: API key from [api.together.ai/settings/api-keys](https://api.together.ai/settings/api-keys)
- **Creds**: `TOGETHER_API_KEY` env var | `Authorization: Bearer <key>` header
- **Docs**: [Quickstart](https://docs.together.ai/docs/quickstart) | [Models](https://docs.together.ai/docs/inference-models) | [API ref](https://docs.together.ai/reference) | [Pricing](https://www.together.ai/pricing)
- **Dashboard**: [api.together.ai](https://api.together.ai)

<!-- AI-CONTEXT-END -->

Managed inference and fine-tuning platform for open-source models. OpenAI SDK compatible — change `base_url` only. 100+ models serverless, plus dedicated GPU clusters for training.

**Best for**: production inference (serverless), fine-tuning (SFT/DPO/RL), GPU cluster training, batch inference at scale.
**Not for**: closed-model hosting (Claude/GPT/Gemini), privacy-critical workloads requiring TEE (see `nearai.md`), static site hosting.

## Pricing (March 2026)

Pricing varies by model — see [together.ai/pricing](https://www.together.ai/pricing) for current rates. Batch inference: 50% off serverless price.

## Models

100+ models across text, vision, code, and embeddings. Key families: Llama 1-4, Mistral/Mixtral, DeepSeek, Qwen, Gemma, Phi, DBRX. Full catalog: https://docs.together.ai/docs/inference-models

## Serverless Inference

```bash
# curl
curl https://api.together.xyz/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOGETHER_API_KEY" \
  -d '{"model": "meta-llama/Llama-3.3-70B-Instruct-Turbo", "messages": [{"role": "user", "content": "Hello"}]}'

# OpenAI SDK (Python) — just change base_url
from openai import OpenAI
client = OpenAI(api_key=os.environ["TOGETHER_API_KEY"], base_url="https://api.together.xyz/v1")
response = client.chat.completions.create(model="meta-llama/Llama-3.3-70B-Instruct-Turbo", messages=[...])
```

Features: streaming, function calling, structured outputs (JSON schema), vision, embeddings, reranking.

## Fine-Tuning

Together AI supports SFT, DPO, and RL fine-tuning jobs via the API. See [fine-tuning docs](https://docs.together.ai/docs/fine-tuning-overview) for dataset format, job creation, and monitoring.

## GPU Clusters

Together AI offers dedicated GPU clusters (H100, H200, B200, GB200) for large-scale training. See [GPU Clusters](https://www.together.ai/products/clusters) for availability and pricing.

## Security

- Store API key: `aidevops secret set TOGETHER_API_KEY`
- Never expose keys in logs or output
- Use service accounts for CI/CD

## See Also

- `tools/infrastructure/fireworks.md` — inference + fine-tuning + custom model hosting (Fireworks AI)
- `tools/infrastructure/nearai.md` — TEE-backed private inference
- `tools/infrastructure/cloud-gpu.md` — raw GPU providers (RunPod, Vast.ai, Lambda)
- `tools/deployment/hosting-comparison.md` — platform comparison including inference hosting
