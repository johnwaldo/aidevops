---
description: Audio/video transcription with local and cloud models — Whisper, Buzz, AssemblyAI, Deepgram
mode: subagent
tools:
  read: true
  bash: true
---

# Audio/Video Transcription

<!-- AI-CONTEXT-START -->

## Quick Reference

- **Helper**: `transcription-helper.sh [transcribe|models|configure|install|status] [options]`
- **Default local model**: Whisper Large v3 Turbo (best speed/accuracy tradeoff)
- **Dependencies**: `yt-dlp` (YouTube), `ffmpeg` (audio extraction), `faster-whisper` or `whisper.cpp` (local)

```bash
transcription-helper.sh transcribe "https://youtu.be/VIDEO_ID"   # YouTube
transcription-helper.sh transcribe recording.mp3                  # Local file
transcription-helper.sh transcribe recording.mp3 --model large-v3-turbo
```

<!-- AI-CONTEXT-END -->

## Decision Flow

1. Privacy required or no internet → **Whisper** (local) or **Buzz** (`tools/voice/buzz.md`)
2. Need speaker diarization → **AssemblyAI** or **Deepgram**
3. Real-time streaming → **Deepgram**
4. Highest accuracy, cloud OK → **AssemblyAI Universal-3 Pro**
5. Free, good enough → **Whisper turbo** locally

| Criterion | Whisper (local) | AssemblyAI | Deepgram |
|-----------|----------------|------------|----------|
| **Privacy** | Full (offline) | Cloud | Cloud |
| **Cost** | Free | $0.15–$0.45/hr | $0.0077/min (Nova-3) |
| **Accuracy** | 9.0–9.8 | 9.6 (U2) | 9.5 (Nova-3) |
| **Diarization** | No | Yes | Yes |
| **Streaming** | No | Yes (WebSocket) | Yes (WebSocket) |

## Input Sources

YouTube (`youtu.be/`, `youtube.com/watch`): `yt-dlp -x --audio-format wav`. Local audio (`.wav/.mp3/.flac/.ogg/.m4a`): direct input. Local video (`.mp4/.mkv/.webm/.avi`): `ffmpeg -i input -vn -acodec pcm_s16le`. HTTP media URLs: `curl` + `ffmpeg`.

## Whisper (Local)

### Model Selection

| Model | Size | Accuracy | Notes |
|-------|------|----------|-------|
| `tiny`/`base` | 75–142MB | 6–7.3/10 | Draft/preview only |
| `small` | 461MB | 8.5/10 | Good balance, multilingual |
| `medium` | 1.5GB | 9.0/10 | **Recommended default** |
| **`turbo`** | **1.5GB** | **9.7/10** | **Large-v3 quality at medium speed** |
| `large-v3` | 2.9GB | 9.8/10 | Best quality, slowest |

```bash
pip install openai-whisper && brew install ffmpeg
whisper audio.mp3 --model medium --language en               # Basic
whisper audio.mp3 --model medium --output_format srt         # SRT subtitles
whisper audio.mp3 --task translate --model medium             # Translate to English
```

### faster-whisper (4x faster, identical accuracy — recommended)

`pip install faster-whisper` — CTranslate2-based. Use `WhisperModel("medium", device="cpu", compute_type="int8")` then `model.transcribe("audio.mp3", language="en")` to iterate segments with `.start` and `.text`.

### whisper.cpp (C++ native, Apple Silicon optimised)

```bash
git clone https://github.com/ggml-org/whisper.cpp && cd whisper.cpp && make
./models/download-ggml-model.sh medium
./build/bin/whisper-cli -m models/ggml-medium.bin -f audio.wav -otxt -osrt
```

## AssemblyAI (Cloud — Speaker Diarization, High Accuracy)

`pip install assemblyai` — `aidevops secret set ASSEMBLYAI_API_KEY`

```python
import assemblyai as aai, os
aai.settings.api_key = os.environ["ASSEMBLYAI_API_KEY"]
config = aai.TranscriptionConfig(speaker_labels=True, speakers_expected=3,
    auto_chapters=True, entity_detection=True, language_detection=True)
transcript = aai.Transcriber().transcribe("meeting.mp3", config=config)
for u in transcript.utterances:
    print(f"Speaker {u.speaker}: {u.text}")
```

Pricing: U3 Pro $0.21–$0.45/hr, U2 $0.15/hr, Streaming $0.15–$0.30/hr. 99 languages. [assemblyai.com/pricing](https://www.assemblyai.com/pricing) (March 2026).

## Deepgram (Cloud — Real-Time, Low Latency)

`pip install deepgram-sdk` — `aidevops secret set DEEPGRAM_API_KEY`

```python
from deepgram import DeepgramClient, PrerecordedOptions
import os
dg = DeepgramClient(os.environ["DEEPGRAM_API_KEY"])
with open("audio.mp3", "rb") as f:
    opts = PrerecordedOptions(model="nova-3", language="en", punctuate=True, diarize=True, smart_format=True)
    r = dg.listen.rest.v("1").transcribe_file({"buffer": f}, opts)
    print(r.results.channels[0].alternatives[0].transcript)
```

Real-time: `dg.listen.asyncwebsocket.v("1")` with `LiveOptions` + `LiveTranscriptionEvents.Transcript` handler. Models: Nova-3 $0.0077/min (36 langs), Nova-3 Medical $0.0077/min (English), Nova-2 $0.0058/min (100+ langs). [deepgram.com/pricing](https://deepgram.com/pricing) (March 2026).

## Other Cloud APIs

| Provider | Model | Accuracy | Cost | Notes |
|----------|-------|----------|------|-------|
| **Groq** | Whisper Large v3 Turbo | 9.6/10 | Free tier | OpenAI-compatible API |
| **ElevenLabs** | Scribe v2 | 9.9/10 | Pay/min | Highest accuracy |
| **Mistral** | Voxtral Mini | 9.7/10 | Pay/token | Multilingual |
| **OpenAI** | Whisper API | 9.5/10 | $0.006/min | Reference implementation |
| **Google** | Gemini 2.5 Pro | 9.7/10 | Pay/token | Multimodal input |
| **NVIDIA** | Parakeet V2 | 9.4/10 | Local/free | English-only, fastest |
| **Apple** | Speech | 9.0/10 | Built-in | macOS 26+, on-device |

Store API keys: `aidevops secret set <PROVIDER>_API_KEY`

## Language & Output

Whisper auto-detects language (omit `--language`). Specify for accuracy: `--language fr`. Supports 99 languages. AssemblyAI: 99 languages (`language_code="fr"` or `language_detection=True`). Deepgram Nova-3: 36 languages; Nova-2: 100+.

Output formats: `.txt` (reading/LLM input), `.srt` (video subtitles), `.vtt` (web subtitles), `.json` (programmatic/timestamps). All tools support all formats.

## Related

- `tools/voice/buzz.md` — Buzz GUI/CLI for offline Whisper transcription
- `tools/voice/speech-to-speech.md` — Full voice pipeline (VAD + STT + LLM + TTS)
- `tools/voice/voice-models.md` — TTS models for speech generation
- `tools/video/yt-dlp.md` — YouTube download helper
