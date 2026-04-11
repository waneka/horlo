---
phase: 01-visual-polish-security-hardening
plan: 06
subsystem: insights/visualization
tags: [recharts, shadcn-chart, theme-variables, accessibility, tdd]
requires:
  - shadcn Chart primitive (src/components/ui/chart.tsx) — installed by 01-01
  - --chart-1..5 CSS variables in globals.css — set by 01-05
  - recharts npm package — installed by 01-01
provides:
  - Recharts horizontal bar chart rendering of collection distributions
  - Theme-reactive chart colors via CSS custom properties
  - aria-label chart summaries for screen readers
affects:
  - /insights page (style, role, dial color, movement distributions)
tech-stack:
  added: []
  patterns:
    - ChartContainer + BarChart (layout="vertical") for horizontal bars
    - Per-bar Cell fill with cycling var(--chart-N) variables
key-files:
  created:
    - tests/balance-chart.test.tsx
  modified:
    - src/components/insights/BalanceChart.tsx
decisions:
  - Cycled --chart-1..5 via index modulo so any distribution length renders coherently
  - Kept emptyMessage default as UI-SPEC copy "Not enough data yet."; insights page still overrides per-chart with specific empty copy
metrics:
  duration: ~8 minutes
  completed: 2026-04-11
---

# Phase 01 Plan 06: BalanceChart Recharts Rewrite Summary

Replaced the interim list rendering in `BalanceChart` with a Recharts horizontal bar chart wired through the shadcn `ChartContainer` primitive, so chart colors flow from `--chart-1..5` CSS variables and flip automatically with the theme.

## What Was Built

**TDD: RED → GREEN**

1. **RED (commit 72bca60):** Added `tests/balance-chart.test.tsx` with four cases:
   - Empty data renders default empty message
   - Custom `emptyMessage` prop honored
   - Data renders chart with `aria-label` summarizing counts
   - Single-entry data renders without throwing
   The aria-label query failed against the old list implementation.

2. **GREEN (commit adb05ad):** Rewrote `src/components/insights/BalanceChart.tsx`:
   - Imports `Bar, BarChart, XAxis, YAxis, Cell` from `recharts`
   - Wraps the chart in shadcn's `ChartContainer` with a `ChartConfig` and `ChartTooltip`
   - `layout="vertical"` Recharts mode = horizontal bars
   - Per-bar `<Cell fill={\`var(--chart-${(i % 5) + 1})\`} />` cycling through `--chart-1..5`
   - `aria-label` on the container: `"{title}: label1: n, label2: n, ..."`
   - Empty state preserved with UI-SPEC copy "Not enough data yet."

## Verification

- `npx vitest run tests/balance-chart.test.tsx` — 4/4 pass
- Full suite: **371 tests passing** (up from 367, +4 new)
- `npm run build` — clean production build
- `npm run lint` — 0 errors, 4 pre-existing warnings unrelated to this plan
- `grep -c "BalanceChart" src/app/insights/page.tsx` returns 5 (1 import + 4 mounts — exceeds required ≥3)
- `grep -q "from 'recharts'"` ✓
- `grep -q "BarChart"` ✓
- `grep -q "var(--chart-"` ✓
- `grep -q "ChartContainer"` ✓
- `grep -q "Not enough data yet."` ✓
- `grep -q "aria-label"` ✓

## Deviations from Plan

None — plan executed exactly as written. The insights page already mounted 4 `<BalanceChart>` instances (style, role, dial color, movement) from prior plans, exceeding the required 3; no restoration needed.

## Known Stubs

None.

## Commits

| Commit  | Type    | Description                                                     |
| ------- | ------- | --------------------------------------------------------------- |
| 72bca60 | test    | add failing tests for Recharts BalanceChart                     |
| adb05ad | feat    | render BalanceChart as Recharts horizontal bar chart            |

## Self-Check: PASSED

- FOUND: src/components/insights/BalanceChart.tsx (modified)
- FOUND: tests/balance-chart.test.tsx (created)
- FOUND commit: 72bca60
- FOUND commit: adb05ad
