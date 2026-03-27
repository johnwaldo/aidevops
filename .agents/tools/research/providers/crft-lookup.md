---
description: CRFT Lookup tech stack detection, Lighthouse scores, meta tags, and sitemap visualization
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

# CRFT Lookup - Tech Stack Detection Provider

<!-- AI-CONTEXT-START -->

## Quick Reference

- **Service**: [crft.studio/lookup](https://crft.studio/lookup) — free, no API key, headless Chromium + Wappalyzer-fork (2500+ fingerprints)
- **Helper**: `~/.aidevops/agents/scripts/tech-stack-helper.sh` (`--provider crft`)
- **Report URL**: `https://crft.studio/lookup/gallery/{domain-slug}` (30-day retention, ~20s per scan)

**Capabilities**:

| Feature | Details |
|---------|---------|
| Tech detection | 2500+ fingerprints: JS frameworks, CMS, analytics, hosting, CDN, e-commerce |
| Lighthouse | Performance, accessibility, SEO, best practices (desktop + mobile, 0–100) |
| Meta tags | OG tags, Twitter cards, title/description with char counts, favicon |
| Sitemap | Interactive tree visualization, page hierarchy |

**Commands**:

```bash
tech-stack-helper.sh lookup example.com --provider crft          # tech stack
tech-stack-helper.sh lookup example.com --provider crft --json   # JSON output
tech-stack-helper.sh report example.com --provider crft          # markdown report
```

**JSON schema** (key fields):
```json
{
  "url": "https://example.com",
  "technologies": [{"name": "React", "category": "ui-libs", "version": "18.2", "confidence": 1.0}],
  "categories": [{"category": "ui-libs", "count": 1, "technologies": ["React"]}]
}
```

<!-- AI-CONTEXT-END -->

## Limitations

- Public sites only — no localhost, intranet, or password-protected pages
- No API — helper uses web scraping; no documented rate limits (use ~5s between scans)
- Reports expire after 30 days; pre-scanned gallery sites load instantly, new scans require submission
- Lighthouse scores not available standalone via helper — use `pagespeed-helper.sh` for dedicated analysis

## Integration Examples

```bash
# SEO audit — tech stack then deep Lighthouse
tech-stack-helper.sh lookup client-site.com --provider crft --json | jq '.technologies'
pagespeed-helper.sh run client-site.com

# Competitor batch analysis
for site in competitor1.com competitor2.com competitor3.com; do
  tech-stack-helper.sh lookup "$site" --provider crft --json
done

# Subdomain sweep
domain-research-helper.sh subdomains example.com | while read -r sub; do
  tech-stack-helper.sh lookup "$sub" --provider crft 2>/dev/null
done
```

## Alternatives

| Feature | CRFT Lookup | Wappalyzer | BuiltWith | PageSpeed Insights |
|---------|-------------|------------|-----------|-------------------|
| Tech detection | 2500+ | 1000+ | 50000+ | No |
| Lighthouse scores | Yes | No | No | Yes (detailed) |
| Meta tag preview | Yes | No | No | No |
| Sitemap visualization | Yes | No | No | No |
| API | No (web only) | Yes (paid) | Yes (paid) | Yes (free) |
| Price | Free | Freemium | Paid | Free |
| CLI | Via helper | Browser ext | No | Via npm |

## Related

- `tools/browser/pagespeed.md` — detailed Lighthouse analysis
- `seo/site-crawler.md` — website crawling
- `seo/domain-research.md` — DNS intelligence
- `tools/browser/browser-automation.md` — browser automation
