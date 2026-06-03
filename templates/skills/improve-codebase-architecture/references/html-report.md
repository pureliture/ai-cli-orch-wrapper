# HTML Report

Generate the architecture review as one HTML file in the OS temp directory. Do not commit it.

## Structure

- Header: repo name, date, short legend.
- Candidate cards: one card per deepening opportunity.
- Top recommendation: one larger card naming the first candidate to pursue.

## Candidate Card Fields

- Title: short, names the deepening.
- Strength badge: `Strong`, `Worth exploring`, or `Speculative`.
- Scope badge: `current contract`, `docs-aligned`, or `requires decision`.
- Files: monospace path list.
- Before/after diagram: side-by-side, central to the card.
- Problem: one sentence.
- Proposed deepening: one sentence.
- Wins: concise bullets using locality, leverage, interface, seam, and tests.
- Risk: provider-neutrality, context-sync ownership, security, runtime, or compatibility caveat when needed.

## Visual Rules

Use Mermaid for graph-shaped relationships such as call flow, dependencies, or sequencing. Use hand-built HTML/CSS/SVG when showing module depth, leakage, or collapse into one deeper module.

Keep diagrams compact enough for before/after comparison. Red means leakage. Amber means decision/doc conflict. Dark thick boxes mean deep modules.

## Public Safety

Do not include real secrets, token values, private repository paths, internal hostnames, webhooks, cloud resource names, private customer/org names, or sensitive runtime output. Use repository file paths and synthetic examples only.

## Minimal Scaffold

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Architecture review</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="module">
      import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
      mermaid.initialize({ startOnLoad: true, theme: 'neutral', securityLevel: 'loose' });
    </script>
  </head>
  <body class="bg-stone-50 text-slate-900">
    <main class="mx-auto max-w-6xl px-6 py-10"></main>
  </body>
</html>
```
