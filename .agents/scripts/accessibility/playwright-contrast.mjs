#!/usr/bin/env node

// Playwright Contrast Extraction — Computed Style Analysis for All Visible Elements
// Part of AI DevOps Framework (t215.3)
//
// Traverses all visible DOM elements via page.evaluate(), extracts computed
// color/backgroundColor (walking ancestors for transparent), fontSize, fontWeight,
// calculates WCAG contrast ratios, and reports pass/fail per element.
//
// Usage: node playwright-contrast.mjs <url> [--format json|markdown|summary] [--level AA|AAA] [--limit N]
//
// Output: JSON array of contrast issues or Markdown report

import { chromium } from 'playwright';

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: null,
    format: 'summary',
    level: 'AA',
    limit: 0,
    failOnly: false,
    timeout: 30000,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format' || args[i] === '-f') {
      options.format = args[++i];
    } else if (args[i] === '--level' || args[i] === '-l') {
      options.level = args[++i]?.toUpperCase();
    } else if (args[i] === '--limit' || args[i] === '-n') {
      options.limit = parseInt(args[++i], 10);
    } else if (args[i] === '--fail-only') {
      options.failOnly = true;
    } else if (args[i] === '--timeout') {
      options.timeout = parseInt(args[++i], 10);
    } else if (args[i] === '--help' || args[i] === '-h') {
      printUsage();
      process.exit(0);
    } else if (!args[i].startsWith('-')) {
      options.url = args[i];
    }
  }

  if (!options.url) {
    console.error('ERROR: URL is required');
    printUsage();
    process.exit(1);
  }

  return options;
}

function printUsage() {
  console.log(`Usage: node playwright-contrast.mjs <url> [options]

Options:
  --format, -f   Output format: json, markdown, summary (default: summary)
  --level, -l    WCAG level: AA (default), AAA
  --limit, -n    Max elements to report (0 = all, default: 0)
  --fail-only    Only report failing elements
  --timeout      Page load timeout in ms (default: 30000)
  --help, -h     Show this help

Examples:
  node playwright-contrast.mjs https://example.com
  node playwright-contrast.mjs https://example.com --format json --fail-only
  node playwright-contrast.mjs https://example.com --level AAA --format markdown`);
}

// ============================================================================
// WCAG Contrast Calculation (runs in browser context via page.evaluate)
// ============================================================================

/**
 * This function runs entirely inside the browser via page.evaluate().
 * It traverses all visible elements, extracts computed styles, resolves
 * effective background colors (walking ancestors for transparent), calculates
 * WCAG contrast ratios, and returns structured results.
 */
function extractContrastData() {
  // --- Color parsing utilities ---

  function parseColor(colorStr) {
    if (!colorStr || colorStr === 'transparent') {
      return { r: 0, g: 0, b: 0, a: 0 };
    }

    // Try rgba first, then hex, fall back to null
    const rgbaMatch = colorStr.match(
      /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/
    );
    if (rgbaMatch) {
      return {
        r: parseInt(rgbaMatch[1], 10),
        g: parseInt(rgbaMatch[2], 10),
        b: parseInt(rgbaMatch[3], 10),
        a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1,
      };
    }

    const hexMatch = colorStr.match(/^#([0-9a-f]{3,8})$/i);
    if (!hexMatch) return null;

    const hex = hexMatch[1];
    const hexParsers = {
      3: () => ({
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1,
      }),
      6: () => ({
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
        a: 1,
      }),
      8: () => ({
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
        a: parseInt(hex.substring(6, 8), 16) / 255,
      }),
    };
    const parser = hexParsers[hex.length];
    return parser ? parser() : null;
  }

  // Alpha-composite foreground over background (both RGBA)
  function alphaComposite(fg, bg) {
    const a = fg.a + bg.a * (1 - fg.a);
    return a === 0
      ? { r: 0, g: 0, b: 0, a: 0 }
      : {
          r: Math.round((fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a),
          g: Math.round((fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a),
          b: Math.round((fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a),
          a,
        };
  }

  // WCAG relative luminance
  function relativeLuminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  // WCAG contrast ratio
  function contrastRatio(l1, l2) {
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // Determine if text is "large" per WCAG (>= 18pt or >= 14pt bold)
  function isLargeText(fontSize, fontWeight) {
    const sizeInPt = parseFloat(fontSize) * 0.75; // px to pt
    const isBold =
      fontWeight === 'bold' ||
      fontWeight === 'bolder' ||
      parseInt(fontWeight, 10) >= 700;
    return sizeInPt >= 18 || (sizeInPt >= 14 && isBold);
  }

  // Generate a CSS selector for an element
  function getSelector(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;

    const parts = [];
    let current = el;
    let depth = 0;

    while (current && current !== document.body && depth < 4) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        parts.unshift(`#${CSS.escape(current.id)}`);
        break;
      }

      if (current.className && typeof current.className === 'string') {
        const classes = current.className
          .trim()
          .split(/\s+/)
          .filter((c) => c && !c.includes(':') && c.length < 40)
          .slice(0, 2);
        if (classes.length > 0) {
          selector += '.' + classes.map((c) => CSS.escape(c)).join('.');
        }
      }

      const parent = current.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter(
          (s) => s.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }

      parts.unshift(selector);
      current = current.parentElement;
      depth++;
    }

    return parts.join(' > ');
  }

  // Walk ancestors to find effective background color (resolve transparent)
  function getEffectiveBackground(el) {
    const ancestors = [];
    let current = el;

    // Collect ancestors from element up to body
    while (current) {
      ancestors.push(current);
      current = current.parentElement;
    }

    // Process from root (body) down to element, compositing backgrounds
    let bg = { r: 255, g: 255, b: 255, a: 1 }; // Start with white (page default)
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const style = window.getComputedStyle(ancestors[i]);
      const bgColor = parseColor(style.backgroundColor);
      if (bgColor && bgColor.a > 0) {
        bg = alphaComposite(bgColor, bg);
      }

      // Factor in element opacity
      const opacity = parseFloat(style.opacity);
      if (opacity < 1) {
        bg = { ...bg, a: bg.a * opacity };
      }
    }

    return bg;
  }

  // Check if element has a background image or gradient (flag for manual review)
  function hasComplexBackground(el) {
    const flags = [];
    let current = el;
    let depth = 0;

    while (current && depth < 6) {
      const style = window.getComputedStyle(current);
      const bgImage = style.backgroundImage;

      if (bgImage && bgImage !== 'none') {
        if (bgImage.includes('gradient')) {
          flags.push('gradient');
        } else if (bgImage.includes('url(')) {
          flags.push('background-image');
        }
      }

      current = current.parentElement;
      depth++;
    }

    return flags.length > 0 ? [...new Set(flags)] : null;
  }

  // Check if element is visible (single-return form)
  function isVisible(el) {
    const hasOffsetParent = el.offsetParent || el.tagName === 'BODY' || el.tagName === 'HTML';
    if (!hasOffsetParent) return false;
    const style = window.getComputedStyle(el);
    const isHidden = style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0;
    if (isHidden) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0;
  }

  // Check if element contains direct text content
  function hasDirectText(el) {
    return [...el.childNodes].some(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
    );
  }

  // Tags to skip during extraction
  const SKIP_TAGS = new Set(['script', 'style', 'meta', 'link', 'noscript', 'br', 'hr']);

  // Check if element should be analysed for contrast
  function shouldAnalyseElement(el, seen) {
    if (!isVisible(el) || !hasDirectText(el)) return null;
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) return null;
    const selector = getSelector(el);
    const isNew = !seen.has(selector);
    if (isNew) seen.add(selector);
    return isNew ? { tag, selector } : null;
  }

  // --- Main extraction ---

  const results = [];
  const allElements = document.querySelectorAll('*');
  const seen = new Set(); // Deduplicate by selector

  for (const el of allElements) {
    const elementInfo = shouldAnalyseElement(el, seen);
    if (!elementInfo) continue;

    const style = window.getComputedStyle(el);

    // Parse foreground color
    const fgColor = parseColor(style.color);
    if (!fgColor) continue;

    // Resolve effective background and check for complex backgrounds
    const bgColor = getEffectiveBackground(el);
    const complexBg = hasComplexBackground(el);

    // Apply element opacity to foreground color
    const elOpacity = parseFloat(style.opacity);
    const effectiveFg =
      elOpacity < 1
        ? { ...fgColor, a: fgColor.a * elOpacity }
        : fgColor;

    // Composite foreground over background for final colors
    const finalFg = alphaComposite(effectiveFg, bgColor);
    const finalBg = bgColor;

    // Calculate luminance and contrast ratio
    const fgLum = relativeLuminance(finalFg.r, finalFg.g, finalFg.b);
    const bgLum = relativeLuminance(finalBg.r, finalBg.g, finalBg.b);
    const ratio = contrastRatio(fgLum, bgLum);

    // Determine text size category and thresholds
    const { tag, selector } = elementInfo;
    const fontSize = style.fontSize;
    const fontWeight = style.fontWeight;
    const largeText = isLargeText(fontSize, fontWeight);
    const aaThreshold = largeText ? 3.0 : 4.5;
    const aaaThreshold = largeText ? 4.5 : 7.0;

    // Get text snippet from direct text nodes
    const textSnippet = [...el.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent.trim())
      .join(' ')
      .substring(0, 80);

    results.push({
      selector,
      tag,
      text: textSnippet,
      foreground: `rgb(${finalFg.r}, ${finalFg.g}, ${finalFg.b})`,
      background: `rgb(${finalBg.r}, ${finalBg.g}, ${finalBg.b})`,
      foregroundRaw: style.color,
      backgroundRaw: style.backgroundColor,
      fontSize,
      fontWeight,
      isLargeText: largeText,
      ratio: Math.round(ratio * 100) / 100,
      aa: {
        threshold: aaThreshold,
        pass: ratio >= aaThreshold,
        criterion: largeText ? '1.4.3 (large text)' : '1.4.3',
      },
      aaa: {
        threshold: aaaThreshold,
        pass: ratio >= aaaThreshold,
        criterion: largeText ? '1.4.6 (large text)' : '1.4.6',
      },
      complexBackground: complexBg,
    });
  }

  return results;
}

// ============================================================================
// Output Formatters
// ============================================================================

function getThresholdForLevel(element, level) {
  return level === 'AAA' ? element.aaa.threshold : element.aa.threshold;
}

function getCriterionForLevel(element, level) {
  return level === 'AAA' ? element.aaa.criterion : element.aa.criterion;
}

function isFailingAtLevel(element, level) {
  return !(level === 'AAA' ? element.aaa.pass : element.aa.pass);
}

function formatFailureDetail(f, level) {
  const threshold = getThresholdForLevel(f, level);
  const criterion = getCriterionForLevel(f, level);
  const lines = [];
  lines.push(`  ${f.selector}`);
  lines.push(
    `    Ratio: ${f.ratio}:1 (need ${threshold}:1) — SC ${criterion}`
  );
  lines.push(`    FG: ${f.foreground} | BG: ${f.background}`);
  lines.push(
    `    Size: ${f.fontSize} weight: ${f.fontWeight}${f.isLargeText ? ' (large text)' : ''}`
  );
  if (f.text) {
    lines.push(`    Text: "${f.text}"`);
  }
  if (f.complexBackground) {
    lines.push(
      `    WARNING: ${f.complexBackground.join(', ')} — manual review needed`
    );
  }
  lines.push('');
  return lines;
}

function formatSummaryHeader(results, failures, complexBgCount, level) {
  const passes = results.length - failures.length;
  const lines = [];
  lines.push('');
  lines.push('--- Playwright Contrast Extraction ---');
  lines.push(`  Elements analysed: ${results.length}`);
  lines.push(`  WCAG ${level} Pass: ${passes}`);
  lines.push(`  WCAG ${level} Fail: ${failures.length}`);
  if (complexBgCount > 0) {
    lines.push(
      `  Complex backgrounds (manual review): ${complexBgCount}`
    );
  }
  lines.push('');
  return lines;
}

function formatComplexBackgrounds(results) {
  const complexElements = results.filter((r) => r.complexBackground);
  if (complexElements.length === 0) return [];
  const lines = [];
  lines.push('--- Elements with Complex Backgrounds ---');
  for (const r of complexElements) {
    lines.push(
      `  ${r.selector} — ${r.complexBackground.join(', ')} (ratio: ${r.ratio}:1)`
    );
  }
  lines.push('');
  return lines;
}

function formatSummary(results, level) {
  const failures = results.filter((r) => isFailingAtLevel(r, level));
  const complexBgCount = results.filter((r) => r.complexBackground).length;

  const lines = formatSummaryHeader(results, failures, complexBgCount, level);

  if (failures.length > 0) {
    lines.push(`--- Failing Elements (WCAG ${level}) ---`);
    for (const f of failures) {
      lines.push(...formatFailureDetail(f, level));
    }
  }

  lines.push(...formatComplexBackgrounds(results));

  return lines.join('\n');
}

function formatMarkdownFailureRow(f, level) {
  const threshold = getThresholdForLevel(f, level);
  const criterion = getCriterionForLevel(f, level);
  const sizeInfo = `${f.fontSize} ${f.fontWeight}${f.isLargeText ? ' (L)' : ''}`;
  const selectorShort =
    f.selector.length > 40
      ? f.selector.substring(0, 37) + '...'
      : f.selector;
  return `| \`${selectorShort}\` | ${f.ratio}:1 | ${threshold}:1 | ${f.foreground} | ${f.background} | ${sizeInfo} | SC ${criterion} |`;
}

function formatMarkdown(results, level) {
  const failures = results.filter((r) => isFailingAtLevel(r, level));
  const passes = results.length - failures.length;

  const lines = [];
  lines.push(`## Contrast Analysis Report (WCAG ${level})`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Elements analysed | ${results.length} |`);
  lines.push(`| Pass | ${passes} |`);
  lines.push(`| Fail | ${failures.length} |`);
  lines.push('');

  if (failures.length > 0) {
    lines.push(`### Failing Elements`);
    lines.push('');
    lines.push(
      `| Element | Ratio | Required | FG | BG | Size | WCAG |`
    );
    lines.push(
      `|---------|-------|----------|----|----|------|------|`
    );
    for (const f of failures) {
      lines.push(formatMarkdownFailureRow(f, level));
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const options = parseArgs();
  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-gpu'],
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });

    const page = await context.newPage();

    // Navigate to URL — use 'load' instead of 'networkidle' to avoid hanging
    // on sites with persistent connections (analytics, websockets, etc.)
    await page.goto(options.url, {
      waitUntil: 'load',
      timeout: options.timeout,
    });

    // Wait for web fonts to load (affects text size and contrast calculations)
    await page.evaluate(() => document.fonts.ready);

    // Extract contrast data from all visible elements
    const results = await page.evaluate(extractContrastData);

    // Apply filters
    let filtered = results;
    if (options.failOnly) {
      filtered = results.filter((r) => isFailingAtLevel(r, options.level));
    }
    if (options.limit > 0) {
      filtered = filtered.slice(0, options.limit);
    }

    // Output
    switch (options.format) {
      case 'json':
        console.log(JSON.stringify(filtered, null, 2));
        break;
      case 'markdown':
        console.log(formatMarkdown(results, options.level));
        break;
      case 'summary':
      default:
        console.log(formatSummary(results, options.level));
        break;
    }

    // Exit code: 1 if any failures at the requested level
    const hasFailures = results.some((r) => isFailingAtLevel(r, options.level));

    await browser.close().catch(() => {});
    process.exit(hasFailures ? 1 : 0);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    if (browser) {
      await browser.close().catch(() => {});
    }
    process.exit(2);
  }
}

main();
