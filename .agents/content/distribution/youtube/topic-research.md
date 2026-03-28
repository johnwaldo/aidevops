---
description: "YouTube topic research - content gaps, trend detection, keyword clustering, angle generation"
mode: subagent
model: sonnet
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

# YouTube Topic Research

Find video topics with proven demand and low competition. Use for: content gaps, rising trends, keyword clustering, angle generation, and validating search demand.

## Data Sources

| Source | What It Provides | Tool |
|--------|-----------------|------|
| YouTube Data API | Search results, video counts per topic | `youtube-helper.sh search` |
| Competitor videos | Topics already covered | `youtube-helper.sh videos` |
| yt-dlp transcripts | Deep topic extraction from video content | `youtube-helper.sh transcript` |
| DataForSEO | YouTube SERP data, keyword volume, competition | `keyword-research-helper.sh` |
| Serper | Google Trends signals, web search context | `seo/serper.md` |
| Memory | Previous research, patterns, preferences | `memory-helper.sh` |

## Workflow: Content Gap Analysis

Compare what competitors cover vs what's missing.

### Step 1: Extract Competitor Topic Maps

```bash
youtube-helper.sh videos @competitor 200 json | node -e "
process.stdin.on('data', d => {
    JSON.parse(d).forEach(v => console.log(v.snippet?.title));
});
" > /tmp/competitor_titles.txt
```

Repeat for 3-5 competitors. Cluster titles with AI:
> Here are [N] video titles from [competitor]. Group into topic clusters. For each: topic name, video count, view trend direction.

### Step 2: Map Your Own Coverage

```bash
youtube-helper.sh videos @yourchannel 200 json | node -e "
process.stdin.on('data', d => {
    JSON.parse(d).forEach(v => console.log(v.snippet?.title));
});
" > /tmp/my_titles.txt
```

### Step 3: Identify Gaps

Gaps = topics where: (a) 2+ competitors have videos, (b) you have zero coverage, (c) at least one competitor video is an outlier (3x+ their median views).

### Step 4: Store Findings

```bash
memory-helper.sh store --type WORKING_SOLUTION --namespace youtube-topics \
  "Content gap: [topic]. Covered by @comp1 (X views), @comp2 (Y views). \
   My coverage: none. Angle opportunity: [description]."
```

## Workflow: Trend Detection

### Method 1: YouTube Search Volume Signals

```bash
youtube-helper.sh search "your niche topic 2026" video 20
# Most results recent (last 30 days) = trending. Old results = saturated.
```

### Method 2: DataForSEO YouTube SERP

```bash
keyword-research-helper.sh volume "topic keyword" --engine youtube
# Returns: video rankings, estimated search volume, competition, related keywords
```

### Method 3: Competitor Upload Velocity

```bash
for ch in @comp1 @comp2 @comp3; do
    echo "=== $ch ==="
    youtube-helper.sh videos "$ch" 20 | head -15
done
# Same topic across multiple channels within 2 weeks = trending
```

### Method 4: Google Trends via Serper

> Search Google Trends for "[topic]" — is interest rising, stable, or declining over the past 12 months?

## Workflow: Keyword Clustering

One video should target one keyword cluster.

### Step 1: Seed Keywords

```bash
for kw in "keyword1" "keyword2" "keyword3"; do
    echo "=== $kw ==="
    youtube-helper.sh search "$kw" video 10
done
```

### Step 2: Extract Related Terms

```bash
youtube-helper.sh video VIDEO_ID json | node -e "
process.stdin.on('data', d => {
    const tags = JSON.parse(d).items?.[0]?.snippet?.tags || [];
    tags.forEach(t => console.log(t));
});
"
```

### Step 3: Cluster with AI

> Here are [N] keywords for [niche]. Group into clusters (one per video topic). For each: primary keyword (highest volume), supporting keywords (2-5), suggested title, estimated competition (low/medium/high).

### Step 4: Validate with Search Volume

```bash
keyword-research-helper.sh volume "primary keyword" --engine youtube
```

## Workflow: Angle Generation

### Step 1: Analyze Existing Coverage

```bash
youtube-helper.sh search "topic" video 20
youtube-helper.sh transcript VIDEO_ID_1
youtube-helper.sh transcript VIDEO_ID_2
youtube-helper.sh transcript VIDEO_ID_3
```

### Step 2: Angle Types

| Angle | Example | When It Works |
|-------|---------|---------------|
| **Contrarian** | "Why [popular opinion] is wrong" | Established topics with consensus |
| **Personal experience** | "I tried [thing] for 30 days" | Lifestyle, health, tech |
| **Comparison** | "[A] vs [B] — which is actually better?" | Products, tools, methods |
| **Deep dive** | "The science behind [thing]" | Topics with surface-level coverage |
| **Beginner-friendly** | "[Topic] explained in 5 minutes" | Complex topics |
| **Update** | "[Topic] in 2026 — what changed" | Evergreen topics with new developments |
| **Case study** | "How [person/company] did [thing]" | Business, strategy, marketing |
| **Mistakes** | "5 [topic] mistakes everyone makes" | How-to niches |
| **Hidden/secret** | "[Topic] features nobody talks about" | Tech, tools, platforms |
| **Cost breakdown** | "The real cost of [thing]" | Finance, lifestyle, business |

### Step 3: Generate Unique Angles

> Topic: [topic]. Existing angles in top 10 videos: [list]. My channel voice: [from memory]. My audience: [from memory].
> Generate 5 unique angles that: (1) aren't in the top 10, (2) match my voice, (3) appeal to my audience, (4) have a clear 30-second hook.

## Output Format

```markdown
## Topic Opportunity: [Topic Name]

**Demand signal**: [search volume, competitor coverage, trend direction]
**Competition**: [low/medium/high] — [X] existing videos, [Y] in last 30 days
**Gap type**: [uncovered / underserved / new angle needed]

### Existing Coverage
- @competitor1: "[title]" — [views] views, [angle used]
- @competitor2: "[title]" — [views] views, [angle used]

### Recommended Angle
**[Angle type]**: [description]
**Working title**: "[suggested title]"
**Hook**: [first 30 seconds concept]
**Why this works**: [reasoning based on gap + audience]

### Keywords to Target
- Primary: [keyword] ([volume])
- Supporting: [kw1], [kw2], [kw3]
```

## Memory Integration

```bash
# Store validated opportunity
memory-helper.sh store --type WORKING_SOLUTION --namespace youtube-topics \
  "Topic: [name]. Demand: [signal]. Competition: [level]. Best angle: [type] — [description]. Keywords: [list]."

# Recall previous research
memory-helper.sh recall --namespace youtube-topics "content gap"

# Store rejected topic (avoid revisiting)
memory-helper.sh store --type FAILED_APPROACH --namespace youtube-topics \
  "Topic [name] rejected: [reason — e.g., too saturated, no search volume]"
```

## Related

- `channel-intel.md` — Competitor data feeds into gap analysis
- `script-writer.md` — Turn validated topics into scripts
- `optimizer.md` — Optimize titles/tags for chosen keywords
- `seo/keyword-research.md` — Deep keyword volume and competition data
- `seo/dataforseo.md` — YouTube SERP API for ranking data
- `seo/serper.md` — Google Trends and web search signals
