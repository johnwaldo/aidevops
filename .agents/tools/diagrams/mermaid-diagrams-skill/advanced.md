# Advanced Configuration & Styling

Configuration, theming, custom styling, troubleshooting, and export for Mermaid diagrams.

## Init Directive

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#3b82f6', 'primaryTextColor': '#ffffff',
    'primaryBorderColor': '#2563eb', 'secondaryColor': '#10b981',
    'lineColor': '#64748b', 'textColor': '#1e293b',
    'fontSize': '16px', 'fontFamily': 'Inter, sans-serif'
  }
}}%%
flowchart LR
    A[Start] --> B{Decision}
    B -->|Yes| C[Success]
    B -->|No| D[Failure]
```

Frontmatter alternative:

```yaml
---
title: My Diagram
config:
  theme: forest
  flowchart:
    defaultRenderer: elk
---
```

## Theme Variables

Themes: `default`, `dark`, `forest`, `neutral`, `base`

**Core:** `primaryColor`, `primaryTextColor`, `primaryBorderColor`, `secondaryColor`, `tertiaryColor`, `lineColor`, `textColor`, `background`, `fontSize`, `fontFamily`

**Diagram-specific:**
- **Flowchart:** `nodeBorder`, `nodeTextColor`, `clusterBkg`, `clusterBorder`, `edgeLabelBackground`
- **Sequence:** `actorBorder`, `actorBkg`, `actorTextColor`, `activationBorderColor`, `signalColor`, `noteBkgColor`, `noteTextColor`
- **State:** `labelColor`, `altBackground`
- **Gantt:** `gridColor`, `todayLineColor`, `taskTextColor`, `doneTaskBkgColor`, `critBkgColor`

## Class-Based Styling

```mermaid
flowchart LR
    A[Start]:::success --> B[Process]:::info --> C[End]:::warning

    classDef success fill:#10b981,stroke:#059669,color:white
    classDef info    fill:#3b82f6,stroke:#2563eb,color:white
    classDef warning fill:#f59e0b,stroke:#d97706,color:white
    classDef default fill:#f8fafc,stroke:#cbd5e1
```

## Individual Node & Link Styling

```mermaid
flowchart LR
    A --> B --> C --> D

    style A fill:#10b981,stroke:#059669,color:white
    style B fill:#3b82f6,stroke:#2563eb,color:white
    style C fill:#ef4444,stroke:#dc2626,color:white

    linkStyle 0 stroke:green,stroke-width:2px
    linkStyle 1 stroke:blue,stroke-width:2px
    linkStyle default stroke:gray,stroke-width:1px
```

Properties: `fill`, `stroke`, `stroke-width`, `stroke-dasharray`, `color`, `font-weight`

## Layout & Directives

**ELK Renderer (v9.4+):** Better complex layouts, predictable edge routing, improved subgraph positioning.

```javascript
%%{init: {
  'theme': 'default',
  'flowchart': { 'defaultRenderer': 'elk', 'curve': 'basis', 'padding': 15 },
  'sequence': { 'showSequenceNumbers': true, 'actorMargin': 50 },
  'gantt':    { 'barHeight': 20, 'fontSize': 11, 'sectionFontSize': 14 }
}}%%
```

Directive keys: `flowchart`, `sequenceDiagram`, `classDiagram`, `stateDiagram`, `erDiagram`, `gantt`

## Security Levels

| Level | Description |
|-------|-------------|
| `strict` | Most secure, no HTML/JS |
| `loose` | Allows some interaction |
| `antiscript` | Allows HTML, blocks scripts |
| `sandbox` | iframe sandbox |

Use `%%{init: { 'securityLevel': 'loose' }}%%` to enable `click A href "..." _blank`.

## Troubleshooting

**Special characters** — escape with HTML entities or quoted strings:

```mermaid
flowchart LR
    A["Node with #quot;quotes#quot;"]
    B["Arrow -> symbol"]
    C["Hash #35; symbol"]
```

**Long labels** — use backtick multiline strings:

```mermaid
flowchart LR
    A["`This is a very long
    label that wraps
    across multiple lines`"]
```

**Arrow syntax by diagram type:**

| Diagram | Sync | Async | Dotted |
|---------|------|-------|--------|
| Flowchart | `-->` | N/A | `-.->` |
| Sequence | `->>` | `-->>` | `-->>` |
| Class | `-->` | N/A | `..>` |
| State | `-->` | N/A | N/A |

**Debugging:** Verify diagram type declaration; check unclosed brackets/quotes; match arrow syntax to type. Start minimal, add elements one at a time. Live editor: https://mermaid.live

## Accessibility & Performance

**Accessibility:** Provide context text before diagrams. HTML: `<div class="mermaid" role="img" aria-label="...">`.

**Performance:** Split large diagrams. Use ELK for complex layouts. Prefer class-based over inline styling. Cache renders; lazy load in docs.

## Export

| Method | Command/Usage |
|--------|--------------|
| Live editor | PNG, SVG, Markdown at https://mermaid.live |
| Programmatic | `const svg = await mermaid.render('id', diagramText)` |
| CLI | `npx @mermaid-js/mermaid-cli -i input.md -o output.svg` |
