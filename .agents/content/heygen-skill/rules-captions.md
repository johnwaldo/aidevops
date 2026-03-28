---
name: captions
description: Auto-generated captions and subtitle options for HeyGen videos
metadata:
  tags: captions, subtitles, accessibility, srt
---

# Video Captions

HeyGen auto-generates captions for videos. Enable via `caption: true` or a config object.

## Enabling Captions

```typescript
const videoConfig = {
  video_inputs: [{ character: { ... }, voice: { ... } }],
  caption: true, // or caption config object below
};
```

## Caption Config

```typescript
interface CaptionConfig {
  enabled: boolean;
  style?: {
    font_family?: string;   // e.g. "Arial"
    font_size?: number;     // px; ≥24 recommended
    font_color?: string;    // hex
    background_color?: string; // hex or rgba
    position?: "top" | "bottom"; // default: "bottom"
  };
  language?: string;
}
```

**Presets (reference values):**

| Preset | font_size | font_color | background |
|--------|-----------|------------|------------|
| default | 32 | #FFFFFF | rgba(0,0,0,0.7) |
| minimal | 28 | #FFFFFF | transparent |
| bold | 36 | #FFFFFF | rgba(0,0,0,0.9) |
| branded | 30 | #00D1FF | rgba(26,26,46,0.9) |

## SRT Files

**Download:**

```typescript
const srt = await fetch(`https://api.heygen.com/v1/video/${videoId}/srt`, {
  headers: { "X-Api-Key": process.env.HEYGEN_API_KEY! },
}).then(r => r.text());
```

**Custom SRT (translation):**

```typescript
const translationConfig = {
  input_video_id: "original_video_id",
  output_languages: ["es-ES", "fr-FR"],
  srt_key: "path/to/custom.srt",
  srt_role: "input", // "input" | "output"
};
```

**SRT format:**

```srt
1
00:00:00,000 --> 00:00:03,000
Caption text here.
```

## Platform Notes

- **TikTok/Reels**: `position: "top"`, `font_size: 42` — avoid bottom 20% (UI overlap)
- **YouTube**: bottom captions standard; closed captions upload also supported
- **LinkedIn**: captions recommended (many watch muted)
- **Multi-language**: captions follow voice language automatically

## Accessibility

- High contrast (white on dark or dark on light)
- `font_size` ≥ 24px standard; ≥ 36px mobile/social
- Position away from key visual elements

## Limitations

- Caption styles limited by subscription tier
- Some features require the web interface
- Multi-speaker detection has limited availability
- Accuracy depends on audio quality

See [video-translation.md](video-translation.md) for translation details.
