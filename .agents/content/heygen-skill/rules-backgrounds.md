---
name: backgrounds
description: Solid colors, images, and video backgrounds for HeyGen videos
metadata:
  tags: backgrounds, color, image, video, customization
---

# Video Backgrounds

## Background Types

| Type | Field | Description |
|------|-------|-------------|
| `color` | `value` (hex) | Solid color |
| `image` | `url` | Static image |
| `video` | `url` | Looping video (audio muted) |

## Color Background

```typescript
background: {
  type: "color",
  value: "#FFFFFF",  // any hex; use "#00FF00" for green screen / chroma key
}
```

## Image Background

```typescript
background: {
  type: "image",
  url: "https://example.com/bg.jpg",
  // or: `https://files.heygen.ai/asset/${assetId}` for uploaded assets
}
```

**Requirements:** JPEG or PNG, match video dimensions and aspect ratio, under 10 MB.

## Video Background

```typescript
background: {
  type: "video",
  url: "https://example.com/bg-loop.mp4",
}
```

**Requirements:** MP4 (H.264), loops if shorter than avatar content, audio muted, under 100 MB.

## Per-Scene Backgrounds

Each element in `video_inputs` can have its own `background`:

```typescript
video_inputs: [
  { ..., background: { type: "image", url: "https://example.com/scene1.jpg" } },
  { ..., background: { type: "image", url: "https://example.com/scene2.jpg" } },
  { ..., background: { type: "color", value: "#1a1a2e" } },
]
```

## Common Issues

**Missing `url`/`value`:**

```typescript
// Wrong
background: { type: "image" }

// Correct
background: { type: "image", url: "https://example.com/bg.jpg" }
```

**Aspect ratio mismatch:** Background is cropped or stretched if dimensions don't match the video. Always use the same resolution (e.g., 1920×1080 for landscape, 1080×1920 for portrait).

**Video background audio:** Muted by default. Add background music as a separate audio track in post-production.
