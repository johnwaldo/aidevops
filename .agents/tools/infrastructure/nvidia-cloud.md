---
description: "NVIDIA Cloud — NIM inference microservices, build.nvidia.com API, DGX Cloud, self-hosted NIM containers"
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

# NVIDIA Cloud (NIM / build.nvidia.com)

<!-- AI-CONTEXT-START -->

## Quick Reference

- **Cloud API**: `https://integrate.api.nvidia.com/v1` (build.nvidia.com, OpenAI-compat)
- **Auth**: NVIDIA API key from [build.nvidia.com](https://build.nvidia.com) | `Authorization: Bearer <key>` header
- **Creds**: `NVIDIA_API_KEY` env var
- **Self-hosted NIM**: Docker containers from `nvcr.io/nim/` — requires NVIDIA AI Enterprise license or NGC account
- **Docs**: [NIM overview](https://docs.nvidia.com/nim/) | [build.nvidia.com](https://build.nvidia.com) | [NIM containers](https://catalog.ngc.nvidia.com/orgs/nim/teams/meta)
- **Dashboard**: [build.nvidia.com](https://build.nvidia.com)

<!-- AI-CONTEXT-END -->

NVIDIA's inference platform: cloud API for prototyping (build.nvidia.com) and self-hosted NIM containers for production. NIM (NVIDIA Inference Microservices) are optimized Docker containers for running models on NVIDIA GPUs with TensorRT-LLM acceleration.

**Best for**: self-hosted optimized inference on NVIDIA GPUs (NIM containers), prototyping with frontier models (build.nvidia.com free credits), organizations with NVIDIA AI Enterprise licenses.
**Not for**: managed serverless inference at scale (use Fireworks/Together), fine-tuning (use NeMo separately), privacy-critical TEE workloads (see `nearai.md`).

## Pricing (March 2026)

- **build.nvidia.com (cloud API)**: Free tier — 1,000 API credits for prototyping. No published per-token serverless pricing for production; cloud API is intended for evaluation only.
- **Self-hosted NIM**: Free with NVIDIA AI Enterprise license (included with DGX systems, available separately). NGC personal accounts get limited free access.
- **DGX Cloud**: Enterprise GPU clusters — contact NVIDIA for pricing.

## Models

100+ models on build.nvidia.com: Llama, Mistral, Gemma, Phi, DeepSeek, Qwen, Nemotron, multimodal (vision, speech), and NVIDIA-optimized variants. Full catalog: https://build.nvidia.com/explore/discover

## Cloud API (build.nvidia.com)

```bash
# OpenAI-compatible REST
curl https://integrate.api.nvidia.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NVIDIA_API_KEY" \
  -d '{"model": "meta/llama-3.3-70b-instruct", "messages": [{"role": "user", "content": "Hello"}]}'

# OpenAI SDK (Python)
from openai import OpenAI
client = OpenAI(api_key=os.environ["NVIDIA_API_KEY"], base_url="https://integrate.api.nvidia.com/v1")
response = client.chat.completions.create(model="meta/llama-3.3-70b-instruct", messages=[...])
```

## Self-Hosted NIM Containers

NIM containers package model weights + TensorRT-LLM optimizations + OpenAI-compatible API server into a single Docker image.

```bash
# Pull and run a NIM container (requires NGC API key and NVIDIA GPU)
export NGC_API_KEY="<your-ngc-api-key>"
docker login nvcr.io --username '$oauthtoken' --password "$NGC_API_KEY"

docker run --gpus all \
  -e NGC_API_KEY="$NGC_API_KEY" \
  -p 8000:8000 \
  nvcr.io/nim/meta/llama-3.3-70b-instruct:latest

# Query the local NIM (OpenAI-compatible)
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "meta/llama-3.3-70b-instruct", "messages": [{"role": "user", "content": "Hello"}]}'
```

NIM containers expose an OpenAI-compatible API at `/v1/chat/completions`. Deploy on any NVIDIA GPU server (cloud or on-prem).

## Security

- Store credentials: `aidevops secret set NVIDIA_API_KEY`
- Never expose keys in logs or output
- Self-hosted NIM: run behind a reverse proxy with auth (nginx/caddy) — NIM containers have no built-in auth

## See Also

- `tools/infrastructure/fireworks.md` — managed inference + fine-tuning (no GPU required)
- `tools/infrastructure/cloud-gpu.md` — raw GPU providers for running NIM or other inference servers
- `tools/infrastructure/nearai.md` — TEE-backed private inference
- `tools/deployment/hosting-comparison.md` — platform comparison including inference hosting
