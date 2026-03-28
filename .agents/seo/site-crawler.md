---
description: SEO site crawler with Screaming Frog-like capabilities
mode: subagent
tools:
  read: true
  write: true
  edit: true
  bash: true
  glob: true
  grep: true
  webfetch: true
  task: true
---

# Site Crawler - SEO Spider Agent

<!-- AI-CONTEXT-START -->

## Quick Reference

- **Purpose**: Comprehensive SEO site auditing like Screaming Frog
- **Helper**: `~/.aidevops/agents/scripts/site-crawler-helper.sh`
- **Browser Tools**: `tools/browser/crawl4ai.md`, `tools/browser/playwriter.md`
- **Output**: `~/Downloads/{domain}/{datestamp}/` with `_latest` symlink
- **Formats**: CSV, XLSX, JSON, HTML reports

```bash
# Full crawl
site-crawler-helper.sh crawl https://example.com

# Scoped crawl
site-crawler-helper.sh crawl https://example.com --depth 3 --max-urls 500 \
  --include "/blog/*" --exclude "/admin/*,/wp-json/*"

# Targeted audits
site-crawler-helper.sh audit-links https://example.com
site-crawler-helper.sh audit-meta https://example.com
site-crawler-helper.sh audit-redirects https://example.com
site-crawler-helper.sh audit-duplicates https://example.com
site-crawler-helper.sh audit-schema https://example.com

# Export format
site-crawler-helper.sh crawl https://example.com --format xlsx   # csv | xlsx | all

# JavaScript rendering (SPAs)
site-crawler-helper.sh crawl https://example.com --render-js

# Custom user agent / ignore robots
site-crawler-helper.sh crawl https://example.com --user-agent "Googlebot"
site-crawler-helper.sh crawl https://example.com --ignore-robots

# Authenticated crawl
site-crawler-helper.sh crawl https://example.com \
  --auth-type form --login-url https://example.com/login \
  --username user@example.com --password-env SITE_PASSWORD

# Sitemap generation
site-crawler-helper.sh generate-sitemap https://example.com \
  --changefreq weekly --priority-rules "/blog/*:0.8,/*:0.5" \
  --exclude "/admin/*,/private/*"

# Crawl comparison
site-crawler-helper.sh compare https://example.com
site-crawler-helper.sh compare ~/Downloads/example.com/2025-01-10_091500 \
  ~/Downloads/example.com/2025-01-15_143022

# Debug
site-crawler-helper.sh crawl https://example.com --verbose
site-crawler-helper.sh crawl https://example.com --save-html
```

<!-- AI-CONTEXT-END -->

## Data Collected

| Category | Fields |
|----------|--------|
| URLs | Address, status code, content type, response time, file size |
| Titles | Text, length, missing/duplicate |
| Meta Descriptions | Text, length, missing/duplicate |
| Meta Robots | Index/noindex, follow/nofollow, canonical, directives |
| Headings | H1/H2 content, missing/duplicate/multiple |
| Links | Internal/external, follow/nofollow, anchor text, broken |
| Images | URL, alt text, file size, missing alt |
| Redirects | Type (301/302/307), chains, loops, final destination |
| Canonicals | URL, self-referencing, conflicts |
| Hreflang | Language codes, return links, conflicts |
| Structured Data | JSON-LD, Microdata, RDFa extraction and validation |

Advanced: JavaScript rendering (Chromium), custom XPath/CSS/regex extraction, robots.txt analysis, XML sitemap parsing, duplicate detection (MD5 + similarity), crawl depth, word count.

## Output Structure

```text
~/Downloads/example.com/
├── 2025-01-15_143022/
│   ├── crawl-data.xlsx        # Full crawl data
│   ├── crawl-data.csv
│   ├── broken-links.csv       # 4XX/5XX errors (URL, status, source, anchor, type)
│   ├── redirects.csv          # Chains (original, status, redirect, final, hops)
│   ├── meta-issues.csv
│   ├── duplicate-content.csv
│   ├── images.csv
│   ├── internal-links.csv
│   ├── external-links.csv
│   ├── structured-data.json
│   └── summary.json
└── _latest -> 2025-01-15_143022
```

**crawl-data columns**: URL, Status Code, Status, Content Type, Title, Title Length, Meta Description, Description Length, H1, H1 Count, H2, H2 Count, Canonical, Meta Robots, Word Count, Response Time, File Size, Crawl Depth, Inlinks, Outlinks, External Links, Images, Images Missing Alt.

## Configuration

`~/.config/aidevops/site-crawler.json`:

```json
{
  "default_depth": 10,
  "max_urls": 10000,
  "respect_robots": true,
  "render_js": false,
  "user_agent": "AIDevOps-Crawler/1.0",
  "request_delay": 100,
  "concurrent_requests": 5,
  "timeout": 30,
  "output_format": "xlsx",
  "output_directory": "~/Downloads",
  "exclude_patterns": ["/wp-admin/*", "/wp-json/*", "*.pdf", "*.zip"]
}
```

Rate limiting: robots.txt honored by default; crawl-delay respected; request delay and concurrency configurable.

## Integrations

```bash
# E-E-A-T analysis on crawled pages
site-crawler-helper.sh crawl https://example.com --format json
eeat-score-helper.sh analyze ~/Downloads/example.com/_latest/crawl-data.json

# PageSpeed data inline
site-crawler-helper.sh crawl https://example.com --include-pagespeed
```

- Crawl4AI: JS rendering, structured data extraction, LLM content analysis, CAPTCHA handling — see `tools/browser/crawl4ai.md`
- Playwriter: authenticated crawls, complex interactions — see `tools/browser/playwriter.md`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Crawl blocked | Check robots.txt; try different `--user-agent` |
| JS not rendering | Add `--render-js` |
| Missing pages | Increase `--depth`; check internal linking |
| Slow crawl | Reduce `--concurrent-requests` or increase `--request-delay` |
| Memory issues | Reduce `--max-urls` or use disk storage mode |

## Related

- `seo/eeat-score.md` — E-E-A-T content quality scoring
- `tools/browser/crawl4ai.md` — AI-powered web crawling
- `tools/browser/playwriter.md` — Browser automation
- `tools/browser/pagespeed.md` — Performance auditing
- `seo/google-search-console.md` — Search performance data
