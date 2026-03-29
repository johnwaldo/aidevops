---
description: "HuggingFace Speech-to-Speech - modular voice pipeline (VAD, STT, LLM, TTS) for local GPU and cloud GPU deployment"
mode: subagent
upstream_url: https://github.com/huggingface/speech-to-speech
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

# Speech-to-Speech Pipeline

<!-- AI-CONTEXT-START -->

## Quick Reference

- **Source**: [huggingface/speech-to-speech](https://github.com/huggingface/speech-to-speech) (Apache-2.0)
- **Pipeline**: VAD → STT → LLM → TTS (each stage swappable, thread-safe queues)
- **Helper**: `speech-to-speech-helper.sh [setup|start|stop|status|client|config|benchmark]`
- **Install dir**: `~/.aidevops/.agent-workspace/work/speech-to-speech/`
- **Languages**: English, French, Spanish, Chinese, Japanese, Korean (`--language auto` or fixed)

**When to Use**: Voice interfaces, transcription pipelines, voice-driven DevOps, phone-based AI (Twilio).

<!-- AI-CONTEXT-END -->

## Components

### STT

| Flag | Engine | Best For |
|------|--------|----------|
| `--stt whisper` | Whisper (Transformers) | CUDA, general |
| `--stt faster-whisper` | Faster Whisper | CUDA, low latency |
| `--stt whisper-mlx` | Lightning Whisper MLX | macOS Apple Silicon |
| `--stt mlx-audio-whisper` | MLX Audio Whisper | macOS, newer models |
| `--stt paraformer` | Paraformer (FunASR) | Chinese, low latency |
| `--stt parakeet-tdt` | Parakeet TDT | CUDA, NVIDIA NeMo |
| `--stt moonshine` | Moonshine | Lightweight |

Model: `--stt_model_name <model>` (any Whisper checkpoint on HF Hub)

### LLM

| Flag | Engine | Best For |
|------|--------|----------|
| `--llm transformers` | Transformers | CUDA, any HF model |
| `--llm mlx-lm` | MLX-LM | macOS Apple Silicon |
| `--llm open_api` | OpenAI API | Cloud, lowest latency |

Model: `--lm_model_name <model>` or `--mlx_lm_model_name <model>`

**Security:** Store `OPENAI_API_KEY` via `aidevops secret set OPENAI_API_KEY` (gopass). See `tools/credentials/api-key-setup.md`.

### TTS

| Flag | Engine | Best For |
|------|--------|----------|
| `--tts parler` | Parler-TTS | CUDA, streaming |
| `--tts melo` | MeloTTS | Multi-language (6 langs) |
| `--tts chatTTS` | ChatTTS | Natural conversational |
| `--tts kokoro` | Kokoro | macOS default, quality |
| `--tts facebookMMS` | FacebookMMS | 1000+ languages |
| `--tts pocket` | Pocket TTS | Lightweight |
| `--tts qwen3-tts` | Qwen3-TTS | 10 langs, voice cloning, 97ms |

VAD: Silero VAD v5 (default) — `--thresh`, `--min_speech_ms`, `--min_silence_ms`

## Deployment

| Mode | Command |
|------|---------|
| macOS (Apple Silicon) | `speech-to-speech-helper.sh start --local-mac` |
| CUDA GPU | `speech-to-speech-helper.sh start --cuda` |
| Server (remote GPU) | `speech-to-speech-helper.sh start --server` |
| Client (audio I/O) | `speech-to-speech-helper.sh client --host <ip>` |
| Docker (CUDA) | `speech-to-speech-helper.sh start --docker` |

Docker uses `pytorch/pytorch:2.4.0-cuda12.1-cudnn9-devel`, ports 12345/12346.

## Setup

```bash
speech-to-speech-helper.sh setup          # clones repo, installs deps
# Manual: uv pip install -r requirements.txt (CUDA) or requirements_mac.txt (macOS)
# MeloTTS: python -m unidic download
```

Requirements: Python 3.10+, PyTorch 2.4+, CUDA 12.1+ or Apple Silicon, `sounddevice`, ~4GB VRAM min.
CLI params: `--stt_*`, `--lm_*`, `--tts_*` prefix convention; `_gen_` infix for generation params. Full ref: `python s2s_pipeline.py -h`

## Recommended Configurations

| Use Case | Flags |
|----------|-------|
| Low latency (CUDA) | `--stt faster-whisper --llm open_api --tts parler --stt_compile_mode reduce-overhead` |
| Low VRAM (~4GB) | `--stt moonshine --llm open_api --tts pocket` |
| Best quality (24GB+) | `--stt whisper --stt_model_name openai/whisper-large-v3 --llm transformers --tts parler` |
| macOS optimal | `--local_mac_optimal_settings --device mps --mlx_lm_model_name mlx-community/Meta-Llama-3.1-8B-Instruct-4bit` |

Multi-language: requires `--stt_model_name large-v3` + multilingual TTS (MeloTTS or ChatTTS; Parler-TTS is English-only).

## Voice Bridge (Recommended for Agent Use)

For talking directly to your AI coding agent, use the voice bridge — simpler and faster than the full S2S pipeline:

```bash
voice-helper.sh talk                              # defaults
voice-helper.sh talk whisper-mlx edge-tts         # explicit engines
voice-helper.sh talk whisper-mlx macos-say        # offline
voice-helper.sh devices / voices / benchmark
```

**Architecture:** `Mic → Silero VAD → Whisper MLX (1.4s) → agent (~4-6s) → Edge TTS (0.4s) → Speaker`
**Round-trip:** ~6-8s. Features: swappable STT/TTS, voice exit phrases, STT sanity checking, session handback, Esc interrupt.

Use the full S2S pipeline for: custom LLMs, server/client deployment, multi-language, phone integration.

## Integrations

- **Voice-driven DevOps**: STT → LLM (DevOps system prompt) → TTS confirms action
- **Transcription**: use Whisper directly — `tools/voice/transcription.md`
- **Phone (Twilio)**: WebSocket audio → S2S pipeline → TTS back to caller — `services/communications/twilio.md`
- **Video narration**: LLM script → TTS audio → Remotion composite — `tools/video/remotion.md`
- **Cloud GPU**: RunPod, Vast.ai, Lambda, NVIDIA Cloud — `tools/infrastructure/cloud-gpu.md`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Cannot use CUDA on macOS` | `--device mps` or `--local_mac_optimal_settings` |
| MeloTTS import error | `python -m unidic download` |
| High latency | `--stt_compile_mode reduce-overhead` |
| Audio crackling | Increase `--min_silence_ms` or check sample rate |
| OOM on GPU | Smaller models or `--llm open_api` |

## See Also

- `tools/voice/cloud-voice-agents.md` — GPT-4o Realtime, MiniCPM-o, NVIDIA Nemotron Speech
- `tools/voice/voice-ai-models.md` — complete model comparison (TTS, STT, S2S)
- `tools/voice/pipecat-opencode.md` — Pipecat real-time voice pipeline
- `tools/voice/qwen3-tts.md` — Qwen3-TTS (voice cloning, voice design, multi-language)
- `tools/video/heygen-skill/rules/voices.md` — AI voice cloning
