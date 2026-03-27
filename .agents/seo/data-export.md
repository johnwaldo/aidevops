---
description: Export SEO data from multiple platforms to TOON format
mode: subagent
tools:
  read: true
  write: false
  edit: false
  bash: true
  glob: true
  grep: true
---

# SEO Data Export

<!-- AI-CONTEXT-START -->

## Quick Reference

- **Purpose**: Export SEO ranking data from multiple platforms to a common TOON format
- **Platforms**: Google Search Console, Bing Webmaster Tools, Ahrefs, DataForSEO
- **Storage**: `~/.aidevops/.agent-workspace/work/seo-data/{domain}/`
- **Format**: TOON (tab-separated, token-efficient)

```bash
# Export from all platforms (default 90 days)
seo-export-helper.sh all example.com --days 90

# Export from specific platform
seo-export-helper.sh gsc example.com
seo-export-helper.sh bing example.com
seo-export-helper.sh ahrefs example.com
seo-export-helper.sh dataforseo example.com

# Country-specific exports
seo-export-ahrefs.sh example.com --country gb
seo-export-dataforseo.sh example.com --location 2276

# List platforms / exports
seo-export-helper.sh list
seo-export-helper.sh exports example.com
```

<!-- AI-CONTEXT-END -->

## Supported Platforms

| Platform | Script | Data Provided | Auth |
|----------|--------|---------------|------|
| Google Search Console | `seo-export-gsc.sh` | queries, pages, clicks, impressions, CTR, position | Service account JSON |
| Bing Webmaster Tools | `seo-export-bing.sh` | queries, clicks, impressions, position | API key |
| Ahrefs | `seo-export-ahrefs.sh` | keywords, URLs, traffic, volume, difficulty, position | API key |
| DataForSEO | `seo-export-dataforseo.sh` | keywords, URLs, traffic, volume, position | Username/password |

## TOON Format

```text
domain	example.com
source	gsc
exported	2026-01-28T10:00:00Z
start_date	2025-10-30
end_date	2026-01-28
---
query	page	clicks	impressions	ctr	position
best seo tools	/blog/seo-tools	150	5000	0.03	8.2
keyword research	/guides/keywords	89	3200	0.028	12.4
```

Header: `domain`, `source`, `exported` (ISO 8601), `start_date`, `end_date`. Data columns match the example above. `volume` and `difficulty` columns are Ahrefs/DataForSEO only.

**File naming**: `{source}-{start-date}-{end-date}.toon` (e.g., `gsc-2025-10-30-2026-01-28.toon`).

**Storage tree**:

```text
~/.aidevops/.agent-workspace/work/seo-data/
└── example.com/
    ├── gsc-2025-10-30-2026-01-28.toon
    ├── bing-2025-10-30-2026-01-28.toon
    ├── ahrefs-2025-10-30-2026-01-28.toon
    ├── dataforseo-2025-10-30-2026-01-28.toon
    └── analysis-2026-01-28.toon
```

## Platform Setup

| Platform | Setup Steps | Env Var |
|----------|-------------|---------|
| GSC | Create service account in Google Cloud Console, enable Search Console API, download JSON key, add service account email to GSC properties | `GOOGLE_APPLICATION_CREDENTIALS="$HOME/.config/aidevops/gsc-credentials.json"` |
| Bing | Verify site at https://www.bing.com/webmasters, Settings > API Access > Generate API Key | `BING_WEBMASTER_API_KEY` |
| Ahrefs | Generate key at https://app.ahrefs.com/user/api | `AHREFS_API_KEY` |
| DataForSEO | Sign up at https://app.dataforseo.com/, get credentials from dashboard | `DATAFORSEO_USERNAME`, `DATAFORSEO_PASSWORD` |

## Integration with Analysis

```bash
seo-analysis-helper.sh example.com              # Full analysis
seo-analysis-helper.sh example.com quick-wins    # Specific analysis
seo-analysis-helper.sh example.com cannibalization
```

See `seo/ranking-opportunities.md` for analysis documentation.

## Troubleshooting

**No data returned**: Verify API credentials are set, domain is verified in the platform. For GSC, ensure service account has property access.

**API rate limits**: Ahrefs 500 req/month (basic), DataForSEO per subscription, GSC 1200 req/min, Bing 10,000 req/day.

**Missing columns**: GSC/Bing lack volume and difficulty data. Ahrefs/DataForSEO provide full keyword metrics. Analysis scripts handle these differences automatically.
