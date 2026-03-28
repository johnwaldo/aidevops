---
description: "Higgsfield AI - Unified API for 100+ generative media models (image, video, voice, audio)"
mode: subagent
context7_id: /websites/higgsfield_ai
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

# Higgsfield AI API

Unified access to 100+ generative media models. Generate images, videos, voice, and audio with automatic infrastructure scaling.

## Quick Reference

| Endpoint | Purpose | Model |
|----------|---------|-------|
| `POST /v1/text2image/soul` | Text to image | Soul |
| `POST /v1/image2video/dop` | Image to video | DOP |
| `POST /higgsfield-ai/dop/standard` | Image to video | DOP Standard |
| `POST /kling-video/v2.1/pro/image-to-video` | Image to video | Kling v2.1 Pro |
| `POST /bytedance/seedance/v1/pro/image-to-video` | Image to video | Seedance v1 Pro |
| `POST /api/characters` | Create character | - |
| `GET /api/generation-results` | Poll job status | - |

**Base URL**: `https://platform.higgsfield.ai`

## Authentication

Two formats depending on endpoint:

**Format 1: Header-based** (v1 endpoints):

```bash
hf-api-key: {api-key}
hf-secret: {secret}
```

**Format 2: Authorization header** (simplified endpoints):

```bash
Authorization: Key {api-key}:{secret}
```

Store credentials in `~/.config/aidevops/credentials.sh`:

```bash
export HIGGSFIELD_API_KEY="your-api-key"
export HIGGSFIELD_SECRET="your-api-secret"
```

## Text-to-Image (Soul Model)

```bash
curl -X POST 'https://platform.higgsfield.ai/v1/text2image/soul' \
  --header 'hf-api-key: {api-key}' \
  --header 'hf-secret: {secret}' \
  --header 'Content-Type: application/json' \
  --data '{
    "params": {
      "prompt": "A serene mountain landscape at sunset",
      "width_and_height": "1696x960",
      "enhance_prompt": true,
      "quality": "1080p",
      "batch_size": 1
    }
  }'
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Text description |
| `width_and_height` | string | Yes | Dimensions (see below) |
| `enhance_prompt` | boolean | No | Auto-enhance (default: false) |
| `quality` | string | No | `720p` or `1080p` (default: 1080p) |
| `batch_size` | integer | No | 1 or 4 (default: 1) |
| `seed` | integer | No | 1-1000000 for reproducibility |
| `style_id` | uuid | No | Preset style ID |
| `style_strength` | number | No | 0-1 (default: 1) |
| `custom_reference_id` | string | No | Character ID (UUID) |
| `custom_reference_strength` | number | No | 0-1 (default: 1) |
| `image_reference` | object | No | Reference image for guidance |

**Supported dimensions**: `1152x2048`, `2048x1152`, `2048x1536`, `1536x2048`, `1344x2016`, `2016x1344`, `960x1696`, `1536x1536`, `1536x1152`, `1696x960`, `1152x1536`, `1088x1632`, `1632x1088`

**Response**: Returns `id`, `type`, `created_at`, and `jobs[]` array with `id`, `status` (`queued`/`processing`/`completed`/`failed`), and `results.url`.

## Image-to-Video (DOP Model)

```bash
curl -X POST 'https://platform.higgsfield.ai/v1/image2video/dop' \
  --header 'hf-api-key: {api-key}' \
  --header 'hf-secret: {secret}' \
  --header 'Content-Type: application/json' \
  --data '{
    "params": {
      "model": "dop-turbo",
      "prompt": "A cat walking gracefully through a garden",
      "input_images": [{"type": "image_url", "image_url": "https://example.com/cat.jpg"}],
      "enhance_prompt": true
    }
  }'
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | `dop-turbo` or `dop-standard` |
| `prompt` | string | Yes | Animation description |
| `input_images` | array | Yes | Source image(s) |
| `input_images_end` | array | No | End frame image(s) |
| `motions` | array | No | Motion presets with strength |
| `seed` | integer | No | 1-1000000 for reproducibility |
| `enhance_prompt` | boolean | No | Auto-enhance prompt |

### Alternative Models

All use `Authorization: Key {api_key}:{api_secret}` and `Content-Type: application/json`.

| Model | Endpoint | Body fields |
|-------|----------|-------------|
| DOP Standard | `POST /higgsfield-ai/dop/standard` | `image_url`, `prompt`, `duration` |
| Kling v2.1 Pro | `POST /kling-video/v2.1/pro/image-to-video` | `image_url`, `prompt` |
| Seedance v1 Pro | `POST /bytedance/seedance/v1/pro/image-to-video` | `image_url`, `prompt` |

## Character Consistency

Create reusable characters for consistent generation:

```bash
curl -X POST 'https://platform.higgsfield.ai/api/characters' \
  --header 'hf-api-key: {api-key}' \
  --header 'hf-secret: {secret}' \
  --form 'photo=@/path/to/photo.jpg'
# Returns: {"id": "3eb3ad49-...", "photo_url": "...", "created_at": "..."}
```

Use in generation params:

```json
{
  "params": {
    "prompt": "Character sitting in a coffee shop",
    "custom_reference_id": "3eb3ad49-775d-40bd-b5e5-38b105108780",
    "custom_reference_strength": 0.9
  }
}
```

## Webhook Integration

```json
{
  "webhook": {"url": "https://your-server.com/webhook", "secret": "your-webhook-secret"},
  "params": {"prompt": "..."}
}
```

## Job Status Polling

```bash
curl -X GET 'https://platform.higgsfield.ai/api/generation-results?id=job_789012' \
  --header 'hf-api-key: {api-key}' \
  --header 'hf-secret: {secret}'
```

Returns `status` (`pending`/`processing`/`completed`/`failed`), `results[].url`. Results retained 7 days.

## Python SDK

```bash
pip install higgsfield-client
```

```python
import higgsfield_client

# Synchronous
result = higgsfield_client.subscribe(
    'bytedance/seedream/v4/text-to-image',
    arguments={'prompt': 'A serene lake at sunset', 'resolution': '2K', 'aspect_ratio': '16:9'}
)
print(result['images'][0]['url'])

# Asynchronous
import asyncio
async def main():
    result = await higgsfield_client.subscribe_async(
        'bytedance/seedream/v4/text-to-image',
        arguments={'prompt': 'A serene lake at sunset', 'resolution': '2K', 'aspect_ratio': '16:9'}
    )
    print(result['images'][0]['url'])
asyncio.run(main())
```

SDK uses `resolution`/`aspect_ratio` (not `width_and_height`/`quality`) — translated internally.

## Error Handling

- **422**: Validation error — `detail[].msg` describes the field issue
- **401**: Invalid or missing credentials
- **Rate limiting**: Platform auto-scales; implement exponential backoff for resilience

## Context7

```text
query-docs("/websites/higgsfield_ai", "text-to-image parameters")
query-docs("/websites/higgsfield_ai", "image-to-video models")
query-docs("/websites/higgsfield_ai", "character consistency")
```

## API vs UI

| Feature | API (`higgsfield.md`) | UI (`higgsfield-ui.md`) |
|---------|----------------------|------------------------|
| Auth | API key + secret | Email/password login |
| Credits | Pay-per-use API credits | Subscription credits |
| Models | Soul, DOP, Kling 2.1/2.6/3.0, Seedance, Seedream v4, Reve, Popcorn | All API models + Nano Banana Pro, GPT Image, Flux Kontext, Wan, Sora, Veo, MiniMax, Grok + 86 apps |
| Speed | Direct API (~5-30s) | Browser automation (~60s) |
| Best for | Programmatic pipelines, batch processing | Subscription credits, UI-only features |

### Verified API Models (2026-02-10)

**Text-to-image**: `soul`, `soul-reference`, `soul-character`, `popcorn`, `popcorn-manual`, `seedream` (v4), `reve`

**Image-to-video**: `dop-standard`, `dop-lite`, `dop-turbo`, `dop-standard-flf`, `dop-lite-flf`, `dop-turbo-flf`, `kling-3.0`, `kling-2.6`, `kling-2.1`, `kling-2.1-master`, `seedance`, `seedance-lite`

**Image edit**: `seedream-edit`

**NOT on API** (web UI only): Nano Banana Pro, GPT Image, Flux Kontext, Seedream 4.5, Wan, Sora, Veo, MiniMax Hailuo, Grok Video

## Related

- **`tools/video/higgsfield-ui.md`** — UI automation subagent (subscription credits, no API key)
- **`tools/video/remotion.md`** — Programmatic video editing
- [Higgsfield Docs](https://docs.higgsfield.ai/) | [Dashboard](https://cloud.higgsfield.ai)
