---
name: text-overlays
description: Adding text overlays with fonts and positioning to HeyGen videos
metadata:
  tags: text, overlays, fonts, positioning, graphics
---

# Text Overlays

Add text overlays to HeyGen videos for titles, captions, lower thirds, and on-screen text.

> **Note:** Text overlay support varies by subscription tier. Some advanced styling options may not be available via API. For auto-generated captions, see [captions.md](captions.md).

## TextOverlay Interface

```typescript
interface TextOverlay {
  text: string;
  x: number;          // X position (pixels or percentage)
  y: number;          // Y position (pixels or percentage)
  width?: number;
  height?: number;
  font_family?: string;
  font_size?: number;
  font_color?: string;
  background_color?: string;
  text_align?: "left" | "center" | "right";
  duration?: {
    start: number;    // seconds
    end: number;
  };
}
```

## Positioning

**Coordinate system:** Origin top-left (0,0). X increases right, Y increases down.

Common positions for 1920×1080:

| Position | X | Y |
|----------|---|---|
| Top-left | 50 | 50 |
| Top-center | 960 | 50 |
| Top-right | 1870 | 50 |
| Center | 960 | 540 |
| Bottom-left | 50 | 1030 |
| Bottom-center | 960 | 1030 |

```typescript
function getTextPosition(
  location: "top-left" | "top-center" | "top-right" | "center" | "bottom-left" | "bottom-center" | "bottom-right",
  videoWidth: number,
  videoHeight: number,
  padding = 50
): { x: number; y: number } {
  const positions = {
    "top-left":      { x: padding,              y: padding },
    "top-center":    { x: videoWidth / 2,        y: padding },
    "top-right":     { x: videoWidth - padding,  y: padding },
    "center":        { x: videoWidth / 2,        y: videoHeight / 2 },
    "bottom-left":   { x: padding,              y: videoHeight - padding },
    "bottom-center": { x: videoWidth / 2,        y: videoHeight - padding },
    "bottom-right":  { x: videoWidth - padding,  y: videoHeight - padding },
  };
  return positions[location];
}
```

## Font Styling

```typescript
const textStyle = {
  font_family: "Arial",
  font_size: 48,
  font_color: "#FFFFFF",
  font_weight: "bold",
  background_color: "rgba(0, 0, 0, 0.5)",
  text_align: "center",
};
```

Common font families: Arial, Helvetica (sans-serif, modern), Times New Roman, Georgia (serif, formal), Roboto, Open Sans (sans-serif, digital).

## Common Patterns

### Title Card

```typescript
const titleOverlay = {
  text: "Product Demo",
  x: 960, y: 540,
  font_family: "Arial", font_size: 72,
  font_color: "#FFFFFF", text_align: "center",
  duration: { start: 0, end: 3 },
};
```

### Lower Third (Name/Title)

```typescript
const lowerThirdOverlay = {
  text: "John Smith\nCEO, Company Inc.",
  x: 100, y: 900,
  font_family: "Arial", font_size: 36,
  font_color: "#FFFFFF",
  background_color: "rgba(0, 102, 204, 0.9)",
  text_align: "left",
  duration: { start: 2, end: 8 },
};
```

### Call to Action

```typescript
const ctaOverlay = {
  text: "Visit example.com",
  x: 960, y: 1000,
  font_family: "Arial", font_size: 42,
  font_color: "#FFD700", text_align: "center",
  duration: { start: 25, end: 30 },
};
```

## Timing Overlays with Script

Match overlay timing to script segments:

```typescript
const overlays = [
  { text: "Welcome",             duration: { start: 0,  end: 3  }, ...titleStyle },
  { text: "Feature Overview",    duration: { start: 3,  end: 8  }, ...subtitleStyle },
  { text: "Analytics Dashboard", duration: { start: 8,  end: 15 }, ...lowerThirdStyle },
  { text: "www.example.com",     duration: { start: 15, end: 20 }, ...ctaStyle },
];
```

## Best Practices

- **Contrast** — sufficient contrast between text and background
- **Size** — large enough to read on mobile
- **Duration** — minimum 3 seconds per overlay
- **Positioning** — avoid overlapping the avatar's face
- **Consistency** — uniform fonts and styles throughout
- **Accessibility** — use color-blind friendly palettes
