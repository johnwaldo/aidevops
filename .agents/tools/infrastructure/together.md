---
description: "Together AI — serverless and dedicated inference, fine-tuning (SFT/DPO/RL), GPU clusters (H100-GB300), batch inference, image/video/audio generation"
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
- **Auth**: API key from [api.together.ai](https://api.together.ai/) dashboard
- **Creds**: `TOGETHER_API_KEY` env var
- **Docs**: [docs.together.ai](https://docs.together.ai/) | [Pricing](https://www.together.ai/pricing) | [Models](https://www.together.ai/models)
- **SDK**: `pip install together` (Python) | `npm install together-ai` (JS)
- **Dashboard**: [api.together.ai](https://api.together.ai/)

<!-- AI-CONTEXT-END -->

Managed inference and training platform for open-source models. OpenAI SDK compatible. Strong research team (FlashAttention, ThunderKittens). GPU clusters available for large-scale training.

**Best for**: production inference (serverless or dedicated), fine-tuning (SFT/DPO), GPU cluster rental (H100 through GB300), image/video generation, batch inference.
**Not for**: closed-model hosting, privacy-critical TEE workloads (see `nearai.md`), edge/CDN inference (see `cloudflare-ai.md`).

## Pricing (March 2026)

### Serverless Inference (pay-per-token, selected models)

| Model | $/M input | $/M output |
|-------|-----------|------------|
| Llama 4 Maverick | $0.27 | $0.85 |
| MiniMax M2.5 | $0.30 ($0.06 cached) | $1.20 |
| Kimi K2.5 | $0.50 | $2.80 |
| GLM-5 | $1.00 | $3.20 |
| DeepSeek V3.1 | $0.60 | $1.70 |
| DeepSeek R1-0528 | $3.00 | $7.00 |
| GPT-OSS 120B | $0.15 | $0.60 |
| Llama 3.3 70B | $0.88 | $0.88 |
| Llama 3 8B Lite | $0.10 | $0.10 |
| Mistral Small 3 | $0.10 | $0.30 |
| Gemma 3n E4B | $0.02 | $0.04 |

Batch inference: 50% off for most models.

### Dedicated Inference

Custom hardware allocation for consistent performance. Contact sales for pricing. Supports H100, H200, B200, GB200 GPUs.

### GPU Clusters

| GPU | Use case |
|-----|----------|
| H100 | Training and inference |
| H200 | Large model training |
| B200 | Next-gen training |
| GB200 NVL72 | Frontier-scale training |
| GB300 NVL72 | Latest generation |

Self-service GPU clusters. Pricing varies by GPU type and commitment.

### Fine-Tuning

SFT and DPO available. Pricing per training token, varies by model size. See [together.ai/pricing](https://www.together.ai/pricing) for current rates.

### Other Modalities

- **Image generation**: FLUX family ($0.0014-$0.08/image), Stable Diffusion, HiDream, Ideogram, Google Imagen
- **Video generation**: Veo 2/3, Kling, MiniMax, Wan, Sora 2 ($0.14-$3.20/video)
- **Audio**: Cartesia Sonic TTS ($65/M chars), Whisper STT ($0.0015/min)
- **Embeddings**: $0.02/M tokens
- **Reranking**: Available

## Usage

```bash
# curl (OpenAI-compatible)
curl https://api.together.xyz/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOGETHER_API_KEY" \
  -d '{"model": "meta-llama/Llama-3.3-70B-Instruct-Turbo", "messages": [{"role": "user", "content": "Hello"}]}'
```

```python
# OpenAI SDK (change base_url only)
from openai import OpenAI
client = OpenAI(api_key=os.environ["TOGETHER_API_KEY"], base_url="https://api.together.xyz/v1")
response = client.chat.completions.create(
    model="meta-llama/Llama-3.3-70B-Instruct-Turbo",
    messages=[{"role": "user", "content": "Hello"}]
)
```

```python
# Together SDK
from together import Together
client = Together()
response = client.chat.completions.create(
    model="meta-llama/Llama-3.3-70B-Instruct-Turbo",
    messages=[{"role": "user", "content": "Hello"}]
)
```

Features: streaming, function calling, structured outputs (JSON mode), vision, image generation, video generation, audio (TTS/STT), embeddings, reranking, moderation.

## Capabilities

| Feature | Status |
|---------|--------|
| Serverless inference | 100+ models |
| Dedicated inference | Custom hardware |
| Batch inference | 50% discount |
| Fine-tuning (SFT) | Yes |
| Fine-tuning (DPO) | Yes |
| GPU clusters | H100 through GB300 |
| Custom model upload | Yes (dedicated containers) |
| Image generation | FLUX, SD, Imagen, Ideogram |
| Video generation | Veo, Kling, MiniMax, Sora |
| Audio (TTS/STT) | Cartesia, Whisper |
| Embeddings | Yes |
| Reranking | Yes |
| Sandbox (dev envs) | Yes |
| Managed storage | Yes |
| OpenAI SDK compat | Yes |

## Fireworks vs Together

Both are strong competitors with similar offerings. Key differences:

| Dimension | Fireworks | Together |
|-----------|-----------|---------|
| CLI tool | `firectl` (full CRUD) | No CLI (REST API only) |
| Fine-tuning methods | SFT, DPO, RFT, Training SDK | SFT, DPO |
| GPU clusters | No | Yes (H100-GB300, self-service) |
| Video generation | No | Yes (Veo, Kling, Sora, etc.) |
| LoRA hot-loading | Yes | Not documented |
| Anthropic SDK compat | Yes | Not documented |
| Deployment shapes | fast/throughput/cost presets | Custom hardware configs |
| Research output | Production-focused | FlashAttention, ThunderKittens |

**Rule of thumb**: Fireworks for `firectl` CLI automation and RFT/Training SDK. Together for GPU clusters and multimodal generation (video/image).

## Security

- Store API key: `aidevops secret set TOGETHER_API_KEY`
- Never expose keys in logs or output
- Use environment variables, not hardcoded keys

## See Also

- `tools/infrastructure/fireworks.md` -- primary competitor (inference + fine-tuning + CLI)
- `tools/infrastructure/nearai.md` -- TEE-backed private inference
- `tools/infrastructure/cloud-gpu.md` -- raw GPU providers
- `tools/deployment/hosting-comparison.md` -- full platform comparison
