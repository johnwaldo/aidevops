---
description: "NVIDIA Cloud — build.nvidia.com API, NIM containers for self-hosted inference, NeMo for training, DGX Cloud"
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

# NVIDIA Cloud

<!-- AI-CONTEXT-START -->

## Quick Reference

- **Cloud API**: `https://integrate.api.nvidia.com/v1` (OpenAI-compat, prototyping)
- **Auth**: API key from [build.nvidia.com](https://build.nvidia.com/) (free, 1000 credits)
- **Creds**: `NVIDIA_API_KEY` env var | `Authorization: Bearer <key>` header
- **Self-host**: NIM containers via `docker pull nvcr.io/nim/<model>` (requires NGC API key)
- **Docs**: [docs.api.nvidia.com](https://docs.api.nvidia.com/) | [NIM docs](https://docs.nvidia.com/nim/) | [build.nvidia.com](https://build.nvidia.com/explore/discover)
- **Licensing**: Cloud API free (credit-based). NIM self-host free with AI Enterprise license or DGX.

<!-- AI-CONTEXT-END -->

NVIDIA's AI inference platform with two modes: (1) free cloud API for prototyping at build.nvidia.com, (2) self-hosted NIM containers for production on your own GPUs. OpenAI SDK compatible.

**Best for**: prototyping with free credits, self-hosted production inference (NIM containers are highly optimized), NVIDIA GPU owners (DGX, HGX), healthcare/biology/simulation models, enterprise with AI Enterprise licenses.
**Not for**: pay-per-token production serverless (no published pricing), fine-tuning via API (use NeMo separately), budget-conscious serverless (use Fireworks/Together), edge inference (use Cloudflare).

## Pricing Model

NVIDIA Cloud has a fundamentally different pricing model from Fireworks/Together/Cloudflare:

| Mode | Cost | Use case |
|------|------|----------|
| **Cloud API** (build.nvidia.com) | Free (1000 API credits, replenishable) | Prototyping, evaluation, development |
| **Self-hosted NIM** | Free with AI Enterprise license or DGX purchase | Production inference on your GPUs |
| **DGX Cloud** | GPU rental (contact sales) | Production without owning hardware |

No published per-token serverless pricing. The cloud API is explicitly for prototyping -- production workloads run on self-hosted NIM or DGX Cloud.

## Models (100+)

### LLMs

DeepSeek V3.1/V3.2, Llama 2/3/3.1/3.2/3.3/4, Mistral/Mixtral family, Qwen 2/2.5/3/3.5, GPT-OSS 20B/120B, Nemotron family (NVIDIA's own), Kimi K2, MiniMax M2.5, GLM-4.7/5, Phi-3/4, Gemma 2/3/3n, Granite, and many more.

### Specialized

- **Retrieval**: Embeddings (NV-Embed, BGE, Arctic), reranking (NV-Rerank, BGE)
- **Vision**: FLUX image gen, Stable Diffusion, object detection, document parsing
- **Healthcare**: AlphaFold2, ESMFold, protein design (RFDiffusion, ProteinMPNN), molecular docking
- **Simulation**: Weather prediction (FourCastNet), climate (CorrDiff)
- **Safety**: NemoGuard (jailbreak detection, content safety, topic control), Llama Guard
- **Code**: StarCoder2, Codestral, CodeGemma

## Usage

### Cloud API (prototyping)

```bash
curl https://integrate.api.nvidia.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NVIDIA_API_KEY" \
  -d '{"model": "meta/llama-3.3-70b-instruct", "messages": [{"role": "user", "content": "Hello"}]}'
```

```python
# OpenAI SDK (change base_url only)
from openai import OpenAI
client = OpenAI(api_key=os.environ["NVIDIA_API_KEY"], base_url="https://integrate.api.nvidia.com/v1")
response = client.chat.completions.create(
    model="meta/llama-3.3-70b-instruct",
    messages=[{"role": "user", "content": "Hello"}]
)
```

### Self-hosted NIM (production)

```bash
# Pull and run NIM container (requires NGC API key and NVIDIA GPU)
export NGC_API_KEY="<your-ngc-api-key>"
docker login nvcr.io --username '$oauthtoken' --password "$NGC_API_KEY"

docker run --gpus all \
  -e NGC_API_KEY="$NGC_API_KEY" \
  -p 8000:8000 \
  nvcr.io/nim/meta/llama-3.3-70b-instruct:latest

# Query (same OpenAI-compatible API)
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "meta/llama-3.3-70b-instruct", "messages": [{"role": "user", "content": "Hello"}]}'
```

NIM containers include NVIDIA's inference optimizations (TensorRT-LLM, quantization, batching). Generally faster than vLLM/TGI for NVIDIA GPUs.

## Cloud API vs Self-Hosted NIM

| Dimension | Cloud API | Self-hosted NIM |
|-----------|-----------|-----------------|
| Cost | Free (credit-based) | GPU cost only (NIM license free with AI Enterprise) |
| Rate limits | Credit-based, limited | Unlimited (your hardware) |
| Latency | Variable (shared infra) | Predictable (dedicated) |
| Models | 100+ | Any NIM-packaged model |
| Custom models | No | Yes (custom NIM containers) |
| Data privacy | NVIDIA sees requests | Full control |
| Setup | API key only | Docker + NVIDIA GPU + NGC key |
| Use case | Prototyping, evaluation | Production |

## Capabilities and Limitations

### Available

- 100+ models across LLM, vision, retrieval, healthcare, simulation
- OpenAI-compatible chat completions API
- Streaming responses
- Embeddings and reranking
- Image generation (FLUX, Stable Diffusion)
- Specialized models (healthcare, weather, safety) not available elsewhere
- Self-hosted NIM with TensorRT-LLM optimizations
- Attestation API (for NIM container verification)

### Not available (via cloud API)

- Fine-tuning -- use NeMo (separate product) or Fireworks/Together
- Batch inference API -- use Fireworks/Together
- Dedicated cloud deployments with autoscaling -- use Fireworks/Together or DGX Cloud
- Published per-token pricing -- credit-based only
- CLI tool -- REST API and Docker only
- Audio/speech models -- limited (use Fireworks/Together/Cloudflare)

## When to Use NVIDIA Cloud

| Scenario | Recommendation |
|----------|---------------|
| Prototyping with many models | Strong fit -- free credits, 100+ models |
| Production on own NVIDIA GPUs | Strong fit -- NIM containers are fastest |
| Healthcare/biology models | Unique -- AlphaFold, ESMFold, molecular docking |
| Enterprise with AI Enterprise license | Strong fit -- NIM is free |
| Pay-per-token serverless production | Use Fireworks or Together instead |
| Fine-tuning via API | Use Fireworks or Together instead |
| Edge/global inference | Use Cloudflare instead |
| Privacy-critical with TEE | Use NEAR AI instead |
| Budget-conscious, no NVIDIA GPUs | Use Fireworks or Together instead |

## NeMo (Training)

NVIDIA NeMo is a separate product for model training and customization:

- **NeMo Customizer**: Fine-tuning (SFT, PEFT, DPO)
- **NeMo Evaluator**: Model evaluation
- **NeMo Data Designer**: Synthetic dataset generation
- **NeMo Guardrails**: Safety and alignment

NeMo is self-hosted or available via DGX Cloud. Not accessible through the build.nvidia.com API.

## Security

- Store API key: `aidevops secret set NVIDIA_API_KEY`
- NGC API key (for NIM pulls): `aidevops secret set NGC_API_KEY`
- Never expose keys in logs or output
- Self-hosted NIM: full data sovereignty, but run behind reverse proxy with auth (NIM has no built-in auth)
- Cloud API: NVIDIA processes requests (no TEE guarantees)

## See Also

- `tools/infrastructure/fireworks.md` -- managed serverless inference + fine-tuning
- `tools/infrastructure/together.md` -- managed inference + GPU clusters
- `tools/infrastructure/nearai.md` -- TEE-backed private inference
- `tools/infrastructure/cloud-gpu.md` -- raw GPU providers for self-hosting NIM
- `tools/deployment/hosting-comparison.md` -- full platform comparison
