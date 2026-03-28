---
description: MuAPI - multimodal AI API for image, video, audio, VFX, workflows, and agents
mode: subagent
tools:
  read: true
  write: false
  edit: false
  bash: true
  glob: false
  grep: false
  webfetch: true
  task: false
---

# MuAPI

<!-- AI-CONTEXT-START -->

## Quick Reference

- **Purpose**: Unified API for multimodal AI generation (image, video, audio, VFX, music, lipsync, specialized apps, storyboarding, workflows, agents)
- **API**: REST at `https://api.muapi.ai/api/v1` — all requests require `x-api-key: $MUAPI_API_KEY`
- **Auth**: API key via `x-api-key` header, stored as `MUAPI_API_KEY` env var
- **CLI**: `muapi-helper.sh [flux|video-effects|vfx|motion|music|lipsync|face-swap|upscale|bg-remove|dress-change|stylize|product-shot|storyboard|agent-*|balance|usage|status|help]`
- **Pattern**: Async submit → receive `request_id` → poll `/api/v1/predictions/{id}/result` (statuses: `processing` → `completed` | `failed`)
- **Webhooks**: Add `?webhook=https://your.endpoint` to any generation endpoint for push notification instead of polling
- **Docs**: [muapi.ai/docs](https://muapi.ai/docs/introduction)

**When to use**:

- Generating images (Flux Dev/Schnell/Pro/Max, Midjourney v7, HiDream)
- Generating video (Wan 2.1/2.2, Runway Gen-3, Kling v2.1, Luma Dream Machine)
- AI video effects (stylization, animation, pretrained effects like VHS, Film Noir, Samurai)
- VFX (explosions, disintegration, levitation, elemental forces)
- Motion controls (zoom, spin, shake, pan, rotate, bounce, 360 orbit)
- Music generation (Suno create/remix/extend)
- Lip-synchronization (Sync-Lipsync, LatentSync, Creatify, Veed)
- Audio utilities (MMAudio text-to-audio, video-to-video audio sync)
- Specialized apps (face swap, skin enhancer, dress change, upscale, background removal, object eraser, image extension, product photography, Ghibli/anime stylization)
- Storyboarding (character persistence, scene management, episodic structure)
- Multi-step workflows (node-based AI pipelines via API)
- AI agents (persistent personas with skills and memory)
- Payments and credits (balance check, usage tracking)

<!-- AI-CONTEXT-END -->

## Setup

```bash
# 1. Get API key: muapi.ai/signup → muapi.ai/access-keys → generate key (shown once)

# 2. Store credentials
aidevops secret set MUAPI_API_KEY
# Or plaintext fallback:
echo 'export MUAPI_API_KEY="your-key-here"' >> ~/.config/aidevops/credentials.sh
chmod 600 ~/.config/aidevops/credentials.sh

# 3. Test
muapi-helper.sh flux "A test image" --sync
```

## Endpoints

### Image Generation (Flux Dev)

```bash
POST /api/v1/flux-dev-image
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | - | Text prompt |
| `image` | string | No | - | Reference image URL (img2img) |
| `mask_image` | string | No | - | Mask for inpainting (white=generate, black=preserve) |
| `strength` | number | No | 0.8 | Transform strength (0.0-1.0) |
| `size` | string | No | 1024*1024 | Output size (512-1536 per dimension) |
| `num_inference_steps` | integer | No | 28 | Inference steps (1-50) |
| `seed` | integer | No | -1 | Reproducibility seed (-1=random) |
| `guidance_scale` | number | No | 3.5 | CFG scale (1.0-20.0) |
| `num_images` | integer | No | 1 | Number of images (1-4) |

### AI Video Effects / VFX / Motion Controls

All three use the same endpoint:

```bash
POST /api/v1/generate_wan_ai_effects
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | - | Effect description |
| `image_url` | string | Yes | - | Source image URL |
| `name` | string | Yes | - | Effect name (case-sensitive — use exact name from playground) |
| `aspect_ratio` | string | No | 16:9 | 1:1, 9:16, 16:9 |
| `resolution` | string | No | 480p | 480p, 720p |
| `quality` | string | No | medium | medium, high |
| `duration` | number | No | 5 | 5-10 seconds |

**Effect names by category:**
- **AI Effects**: Cakeify, Film Noir, VHS Footage, Samurai, and more
- **VFX**: Building Explosion, Car Explosion, Disintegration, Levitation, Lightning, Tornado, Fire, Ice, and more
- **Motion**: 360 Orbit, Zoom In/Out, Spin, Shake, Bounce, Pan Left/Right

### Music Generation (Suno)

```bash
POST /api/v1/suno-create-music    # Generate new tracks
POST /api/v1/suno-remix-music     # Remix existing audio
POST /api/v1/suno-extend-music    # Extend existing tracks
```

### Lip-Synchronization

```bash
POST /api/v1/sync-lipsync         # Sync-Lipsync (high-fidelity)
POST /api/v1/latentsync-video     # LatentSync (fast)
POST /api/v1/creatify-lipsync     # Creatify
POST /api/v1/veed-lipsync         # Veed
```

### Audio Utilities (MMAudio)

```bash
POST /api/v1/mmaudio-v2/text-to-audio     # Text to audio/Foley/SFX
POST /api/v1/mmaudio-v2/video-to-video    # Sync audio with video
```

### Workflows

```bash
POST /api/workflow/{workflow_id}/run    # Execute a workflow
```

Node-based execution graphs combining text, image, video, audio, and utility nodes. Build via web UI or the Agentic Workflow Architect (natural language).

### Agents

```bash
POST   /agents/quick-create              # Create agent from goal
POST   /agents/suggest                   # Get agent config suggestion
GET    /agents/skills                    # List available skills
POST   /agents                           # Create agent with skills
GET    /agents/user/agents               # List user's agents
GET    /agents/{agent_id}                # Get agent details
PUT    /agents/{agent_id}                # Update agent
DELETE /agents/{agent_id}                # Delete agent
POST   /agents/{agent_id}/chat           # Chat with agent
```

Agents are persistent AI personas with skills, memory (via `conversation_id`), and access to the full model catalog.

### Specialized Apps

All follow the standard async pattern. Submit with input data → receive `request_id` → poll at `/api/v1/predictions/{id}/result`.

#### Portrait & Identity

```bash
POST /api/v1/ai-image-face-swap         # Face swap on images
POST /api/v1/ai-video-face-swap         # Face swap on videos
POST /api/v1/ai-skin-enhancer           # Skin retouching
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image` / `image_url` | string | Yes | Source image/video URL |
| `face_image` | string | Yes (face-swap) | Face reference image URL |

#### Creative Transformations

```bash
POST /api/v1/ai-dress-change            # Swap outfits via text or reference
POST /api/v1/ai-ghibli-style            # Studio Ghibli stylization
POST /api/v1/ai-anime-generator         # Anime style transformation
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image_url` | string | Yes | Source image URL |
| `prompt` | string | No | Desired outfit/style description |

#### Image Processing & Utilities

```bash
POST /api/v1/ai-image-upscale           # Increase resolution with detail regeneration
POST /api/v1/ai-background-remover      # High-precision subject isolation
POST /api/v1/ai-object-eraser           # Remove unwanted elements with inpainting
POST /api/v1/ai-image-extension         # Outpaint beyond original borders
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image_url` | string | Yes | Source image URL |
| `mask_url` | string | No (eraser) | Mask indicating area to erase |
| `prompt` | string | No (extension) | Description for outpainted area |

#### Product & Marketing

```bash
POST /api/v1/ai-product-shot            # Studio-quality product backgrounds
POST /api/v1/ai-product-photography     # High-converting product assets
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image_url` | string | Yes | Product image URL |
| `prompt` | string | No | Background/scene description |

### Storyboarding

Cinematic production system with character persistence across scenes and episodes.

```bash
POST /api/storyboard/projects           # Create storyboard project
```

**Process**: (1) Define `StoryboardCharacter` with static features (age, hair) and dynamic features (outfit, mood) → (2) Create project with characters and creative brief → (3) Generate episodes → (4) Define scenes/shots linked to characters and backgrounds for visual consistency.

Asset generation uses Flux and Runway. Storyboard assets can feed into workflows for post-processing (VFX, color grading).

### Payments & Credits

```bash
POST /api/v1/payments/create_credits_checkout_session   # Purchase credits via Stripe
GET  /api/v1/payments/credits                           # Check credit balance
GET  /api/v1/payments/usage                             # Check usage history
```

Credit-based consumption: every user has a `CreditWallet`; generations deduct credits based on model cost and duration. Enterprise: custom credit limits, private deployment billing, multi-key project tracking.

## CLI Helper

```bash
muapi-helper.sh flux "A cyberpunk city at night"
muapi-helper.sh flux "A portrait" --size 1024*1536 --steps 40
muapi-helper.sh video-effects "dramatic scene" --image https://example.com/scene.jpg --effect "Film Noir"
muapi-helper.sh vfx "a car" --image https://example.com/car.jpg --effect "Car Explosion"
muapi-helper.sh motion "a person" --image https://example.com/person.jpg --effect "360 Orbit"
muapi-helper.sh music "upbeat electronic track with synths"
muapi-helper.sh lipsync --video https://example.com/video.mp4 --audio https://example.com/audio.mp3
muapi-helper.sh face-swap --image https://example.com/photo.jpg --face https://example.com/face.jpg
muapi-helper.sh face-swap --video https://example.com/video.mp4 --face https://example.com/face.jpg --mode video
muapi-helper.sh upscale --image https://example.com/lowres.jpg
muapi-helper.sh bg-remove --image https://example.com/product.jpg
muapi-helper.sh dress-change --image https://example.com/person.jpg "red evening gown"
muapi-helper.sh stylize --image https://example.com/photo.jpg --style ghibli
muapi-helper.sh product-shot --image https://example.com/product.jpg "minimalist white studio"
muapi-helper.sh object-erase --image https://example.com/scene.jpg --mask https://example.com/mask.png
muapi-helper.sh image-extend --image https://example.com/photo.jpg "extend the landscape"
muapi-helper.sh skin-enhance --image https://example.com/portrait.jpg
muapi-helper.sh balance
muapi-helper.sh usage
muapi-helper.sh status <request-id>
muapi-helper.sh agent-create "I want an agent that creates brand assets"
muapi-helper.sh agent-chat <agent-id> "Design a logo for Vapor"
muapi-helper.sh agent-list
```

## MuAPI vs WaveSpeed vs Runway

| Feature | MuAPI | WaveSpeed | Runway |
|---------|-------|-----------|--------|
| Image models | Flux, Midjourney, HiDream | Flux, DALL-E, Imagen, Z-Image | Gen-4 Image, Gemini |
| Video models | Wan, Runway, Kling, Luma | Wan, Kling, Sora, Veo | Gen-4, Veo 3, Act Two |
| Audio | Suno music, MMAudio, lipsync | Ace Step music, TTS | ElevenLabs TTS/STS/SFX |
| VFX/Effects | Built-in effects library | None | None |
| Specialized Apps | Face swap, upscale, bg-remove, dress change, stylize, product shot | None | None |
| Storyboarding | Character persistence, episodic structure | None | None |
| Workflows | Node-based pipeline builder | None | None |
| Agents | Persistent AI personas | None | None |
| Auth | `x-api-key` header | Bearer token | Bearer token |
| Best for | Creative orchestration, effects | Unified model access | Full media pipeline |

## Troubleshooting

**"Unauthorized" / 401**: Verify key is set (`echo "${MUAPI_API_KEY:+set}"`), check key was copied correctly, verify account has credits.

**Task stuck in "processing"**: Video/effects tasks take 1-2 minutes. Helper polls with configurable interval. For long tasks: `--timeout 600`.

**Effect not found**: Effect names are case-sensitive. Use exact name from MuAPI playground (e.g., "Cakeify", "Film Noir", "Car Explosion", "360 Orbit").

## Related

- [MuAPI Documentation](https://muapi.ai/docs/introduction)
- [MuAPI Playground](https://muapi.ai/playground)
- `tools/video/wavespeed.md` - WaveSpeed AI (alternative unified API)
- `tools/video/runway.md` - Runway API (alternative media pipeline)
- `tools/video/video-prompt-design.md` - Prompt engineering for video models
- `tools/vision/image-generation.md` - Image generation workflows
- `content/production/video.md` - Video production pipeline
- `content/production/audio.md` - Audio production pipeline
