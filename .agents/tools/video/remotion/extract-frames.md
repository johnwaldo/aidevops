---
name: extract-frames
mode: subagent
description: Extract frames from videos at specific timestamps using Mediabunny
metadata:
  tags: frames, extract, video, thumbnail, filmstrip, canvas
---

# Extracting frames from videos

Use Mediabunny to extract frames from videos at specific timestamps — useful for thumbnails, filmstrips, or per-frame processing.

## `extractFrames()` — copy-paste into any project

```tsx
import {
  ALL_FORMATS,
  Input,
  UrlSource,
  VideoSample,
  VideoSampleSink,
} from "mediabunny";

type Options = {
  track: { width: number; height: number };
  container: string;
  durationInSeconds: number | null;
};

export type ExtractFramesTimestampsInSecondsFn = (
  options: Options
) => Promise<number[]> | number[];

export type ExtractFramesProps = {
  src: string;
  timestampsInSeconds: number[] | ExtractFramesTimestampsInSecondsFn;
  onVideoSample: (sample: VideoSample) => void;
  signal?: AbortSignal;
};

export async function extractFrames({
  src,
  timestampsInSeconds,
  onVideoSample,
  signal,
}: ExtractFramesProps): Promise<void> {
  using input = new Input({
    formats: ALL_FORMATS,
    source: new UrlSource(src),
  });

  const [durationInSeconds, format, videoTrack] = await Promise.all([
    input.computeDuration(),
    input.getFormat(),
    input.getPrimaryVideoTrack(),
  ]);

  if (!videoTrack) throw new Error("No video track found in the input");
  if (signal?.aborted) throw new Error("Aborted");

  const timestamps =
    typeof timestampsInSeconds === "function"
      ? await timestampsInSeconds({
          track: { width: videoTrack.displayWidth, height: videoTrack.displayHeight },
          container: format.name,
          durationInSeconds,
        })
      : timestampsInSeconds;

  if (timestamps.length === 0) return;
  if (signal?.aborted) throw new Error("Aborted");

  const sink = new VideoSampleSink(videoTrack);

  for await (using videoSample of sink.samplesAtTimestamps(timestamps)) {
    if (signal?.aborted) break;
    if (!videoSample) continue;
    onVideoSample(videoSample);
  }
}
```

## Basic usage

```tsx
await extractFrames({
  src: "https://remotion.media/video.mp4",
  timestampsInSeconds: [0, 1, 2, 3, 4],
  onVideoSample: (sample) => {
    const canvas = document.createElement("canvas");
    canvas.width = sample.displayWidth;
    canvas.height = sample.displayHeight;
    sample.draw(canvas.getContext("2d")!, 0, 0);
  },
});
```

## Filmstrip (dynamic timestamps via callback)

```tsx
const canvasWidth = 500;
const canvasHeight = 80;
const fromSeconds = 0;
const toSeconds = 10;

await extractFrames({
  src: "https://remotion.media/video.mp4",
  timestampsInSeconds: async ({ track, durationInSeconds }) => {
    const aspectRatio = track.width / track.height;
    const amountOfFramesFit = Math.ceil(canvasWidth / (canvasHeight * aspectRatio));
    const segmentDuration = toSeconds - fromSeconds;
    return Array.from({ length: amountOfFramesFit }, (_, i) =>
      fromSeconds + (segmentDuration / amountOfFramesFit) * (i + 0.5)
    );
  },
  onVideoSample: (sample) => {
    console.log(`Frame at ${sample.timestamp}s`);
    // draw to canvas as above
  },
});
```

## Cancellation with AbortSignal

Pass `signal` to abort mid-extraction. For a hard timeout, combine with `Promise.race` and clear the timeout on abort to avoid leaks:

```tsx
const controller = new AbortController();

// Simple timeout abort
const timeoutId = setTimeout(() => controller.abort(), 5000);
controller.signal.addEventListener("abort", () => clearTimeout(timeoutId), { once: true });

try {
  await extractFrames({
    src: "https://remotion.media/video.mp4",
    timestampsInSeconds: [0, 1, 2, 3, 4],
    onVideoSample: (sample) => {
      using frame = sample;
      frame.draw(document.createElement("canvas").getContext("2d")!, 0, 0);
    },
    signal: controller.signal,
  });
} catch (error) {
  console.error("Frame extraction aborted or failed:", error);
}
```
