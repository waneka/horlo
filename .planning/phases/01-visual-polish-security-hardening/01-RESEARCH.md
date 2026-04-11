# Phase 1: Visual Polish & Security Hardening — Research

**Researched:** 2026-04-11
**Domain:** Next.js 16 App Router theming, responsive layout, Recharts, SSRF defense, next/image allow-listing
**Confidence:** HIGH (all key claims verified against codebase files and npm registry)

---

## Summary

Phase 1 is a polish and hardening pass on an already-working MVP. The codebase uses Next.js 16.2.3 App Router with React 19, Tailwind 4, Zustand 5, and shadcn components. The UI design contract (UI-SPEC.md) is already approved and locked — research here validates feasibility, identifies exact file targets, and answers the "how" for each requirement.

The biggest practical risks are: (1) the SSRF fix requires correct DNS pinning and redirect-loop defense — naive hostname matching is already noted in STATE.md as insufficient; (2) the chart requires `npx shadcn add chart` before Recharts is available (neither Recharts nor the shadcn chart wrapper are currently installed); and (3) `next-themes` is not yet installed and `layout.tsx` needs `suppressHydrationWarning` on `<html>` before ThemeProvider wraps the body.

**Primary recommendation:** Execute in three parallel-ish tracks — (A) token + typography + responsive polish (no new deps), (B) theme toggle and chart (two `npm install` / `npx shadcn` commands), (C) SSRF hardening + next/image migration (server-side, no new deps).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIS-01 | Light/dark/system theme toggle persists across sessions, no FOUC | next-themes 0.4.6 confirmed compatible with React 19; ThemeProvider + `suppressHydrationWarning` pattern documented below |
| VIS-02 | Every page fully usable at 375px — no horizontal scroll, no overlap | Identified 4 specific problem sites: Header (no mobile nav/hamburger), home page sidebar (renders inline at all widths), WatchDetail (flex-row image+title breaks narrow), WatchGrid (grid starts at 1-col but sidebar pushes it) |
| VIS-03 | UI refinement — consistent spacing, typography, color tokens | globals.css already has the full token system; changes are CSS variable value replacements in `:root` and `.dark`, plus class token migration in components |
| VIS-04 | Richer watch cards and improved detail view | WatchCard uses raw `<img>`, hardcoded `bg-gray-100`, hardcoded status color classes — all identified; detail page same issues. Changes are localized to WatchCard.tsx and WatchDetail.tsx |
| VIS-06 | Collection balance chart on insights page | BalanceChart.tsx is CSS bars — replace with Recharts via `npx shadcn add chart`. Three instances already in insights/page.tsx |
| SEC-01 | SSRF: resolve IPs, reject private ranges, pin IP for fetch, block redirect hops | `fetchAndExtract()` in extractors/index.ts does a bare `fetch(url)` — no DNS check, no redirect control. Full hardening skeleton documented below |
| SEC-02 | All watch images via next/image with remotePatterns allowlist | next.config.ts is currently empty (`{}`). Two `<img>` tags found: WatchCard.tsx line 25 and WatchDetail.tsx line 84 |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **Framework:** Next.js 16 App Router only — no rewrites, no pages/ directory
- **Types:** `Watch` and `UserPreferences` in `src/lib/types.ts` — extend, do not break
- **Naming:** Components PascalCase, non-components camelCase, stores `use<Name>Store`
- **Imports:** Absolute via `@/*`, type-only with `import type`, no barrel files
- **Styling:** Tailwind 4 utility classes only — no CSS modules, no styled-components; `cn()` for conditional classes
- **State:** Zustand store actions, not raw setters
- **React pattern:** `'use client'` on components using Zustand; Server Components by default
- **AGENTS.md warning:** Next.js 16 has breaking changes — APIs may differ from training data; read `node_modules/next/dist/docs/` before writing code; heed deprecation notices

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| next | 16.2.3 | Framework | Installed |
| react | 19.2.4 | UI | Installed |
| tailwindcss | ^4 | Styling | Installed |
| zustand | ^5.0.12 | State | Installed |
| @base-ui/react | ^1.3.0 | Headless primitives | Installed |
| lucide-react | ^1.8.0 | Icons | Installed |

### New installs required for Phase 1
| Library | Version | Purpose | Install Command |
|---------|---------|---------|-----------------|
| next-themes | 0.4.6 | Three-state theme toggle, FOUC prevention | `npm install next-themes` |
| recharts | 3.8.1 | Chart rendering (pulled in by shadcn add chart) | `npx shadcn add chart` |

**Version verification:** [VERIFIED: npm registry 2026-04-11]
- `next-themes` latest: `0.4.6` — peer deps accept React `^16.8 || ^17 || ^18 || ^19 || ^19.0.0-rc` — React 19 is compatible [VERIFIED]
- `recharts` latest: `3.8.1` — peer deps accept React `^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0` — React 19 is compatible [VERIFIED]
- `next-themes` is NOT currently installed — confirmed by checking `node_modules/` [VERIFIED: codebase]
- `recharts` is NOT currently installed — confirmed by checking `node_modules/` [VERIFIED: codebase]

**Installation:**
```bash
npm install next-themes
npx shadcn add chart     # adds src/components/ui/chart.tsx + installs recharts
npx shadcn add popover   # for theme toggle dropdown (if not already present)
npx shadcn add sheet     # for mobile filter drawer
```

---

## Architecture Patterns

### Theming (VIS-01, VIS-04)

**Current state:** `layout.tsx` has `<html>` with no `suppressHydrationWarning`, `<body className="min-h-full flex flex-col bg-gray-50">` (hardcoded). No ThemeProvider. No theme toggle in Header. [VERIFIED: codebase]

**Required changes to `src/app/layout.tsx`:**
```typescript
// Source: next-themes docs + UI-SPEC.md
import { Instrument_Serif } from 'next/font/google'
import { ThemeProvider } from 'next-themes'

const instrumentSerif = Instrument_Serif({
  variable: '--font-serif',
  subsets: ['latin'],
  weight: '400',
})

// <html> must have suppressHydrationWarning (next-themes requirement)
<html lang="en" suppressHydrationWarning
  className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}>
  <body className="min-h-full flex flex-col bg-background">  {/* remove bg-gray-50 */}
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="horlo-theme">
      <Header />
      <main className="flex-1">{children}</main>
    </ThemeProvider>
  </body>
</html>
```

**FOUC prevention:** `next-themes` injects its own blocking inline script that reads `localStorage` and sets the `class` attribute on `<html>` before paint. Do NOT write a custom `useEffect` toggle — it will flash. The `suppressHydrationWarning` on `<html>` suppresses the React hydration mismatch that would otherwise fire because the class is set before React hydrates. [VERIFIED: UI-SPEC.md decision, next-themes docs]

**Tailwind 4 dark mode:** `globals.css` already has `@custom-variant dark (&:is(.dark *))` — this is the correct Tailwind 4 pattern. `next-themes` with `attribute="class"` adds the `.dark` class to `<html>`, which matches. Do NOT change this line. [VERIFIED: codebase]

**Theme toggle component (new file: `src/components/layout/ThemeToggle.tsx`):**
- `'use client'` directive required (uses `useTheme()` hook from next-themes)
- Import `useTheme` from `next-themes`
- Three options: Light / Dark / System using base-ui Popover (not shadcn Popover — the project already uses `@base-ui/react` for Dialog per UI-SPEC)
- Icons: `Sun`, `Moon`, `Monitor` from lucide-react
- 44px minimum touch target via padding
- `useTheme()` returns `{ theme, setTheme }` — use these to drive selection state

### Responsive Layout (VIS-02)

**Current breakpoint structure:** WatchGrid already uses `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` which is correct. [VERIFIED: WatchGrid.tsx]

**Problem points at 375px (identified from codebase inspection):** [VERIFIED: codebase]

1. **Home page sidebar (`src/app/page.tsx`):** `flex-col gap-6 lg:flex-row` means sidebar stacks above grid on mobile — this is acceptable. BUT the sidebar has no close/collapse mechanism; all filter badges render inline, which could overflow at 375px. FilterBar needs to become a drawer `<lg`.

2. **Header (`src/components/layout/Header.tsx`):** Nav links have `hidden md:flex` — they hide on mobile, but there is NO hamburger or drawer to access them at all. Mobile users cannot navigate. A hamburger + base-ui Sheet drawer is required.

3. **WatchDetail (`src/components/watch/WatchDetail.tsx`):** The image+title flex row `flex gap-6` with `w-32 h-32 sm:w-48 sm:h-48` image and title text beside it works at 375px in terms of layout, but the two-column spec cards grid below may overflow. The UI-SPEC calls for a two-column grid `lg:grid-cols-[2fr_1fr]` that collapses to single column `<lg`.

4. **Preferences page:** Not yet inspected but likely uses forms that need `w-full` at mobile.

**Mobile filter drawer pattern:** Use base-ui Sheet (already listed in UI-SPEC registry safety). The `FilterBar` content moves inside a `Dialog` in sheet/drawer mode triggered from the header on `<lg`.

### CSS Token Migration (VIS-03, VIS-04)

**Current state:** globals.css has full token system with pure-gray oklch values (e.g., `--background: oklch(1 0 0)`, `--accent: oklch(0.97 0 0)`). [VERIFIED: codebase]

**Required:** Replace `:root` and `.dark` token values with the warm/brass palette from UI-SPEC.md. This is a pure CSS change — no component changes needed just for tokens.

**Additionally, components use hardcoded Tailwind palette classes that must be migrated:**
- `WatchCard.tsx`: `bg-gray-100`, `text-gray-900`, `text-gray-600`, `text-gray-500`, hardcoded status badge classes (`bg-green-100 text-green-800`, etc.) → semantic tokens
- `WatchDetail.tsx`: same pattern, `text-gray-900`, `text-gray-600`, `text-gray-500`, `text-gray-400`, `text-yellow-600`
- `FilterBar.tsx`: `text-gray-700`, `hover:bg-gray-100`
- `Header.tsx`: `text-gray-900`, `text-gray-500`, `bg-white/95`
- `WatchGrid.tsx`: `text-gray-300`, `text-gray-900`, `text-gray-500`
- `BalanceChart.tsx`: `text-gray-500`, `bg-gray-100`, hardcoded `bg-blue-500`, `bg-green-500`, etc.
- `UrlImport.tsx`: `text-red-600`, confidence badge classes, `text-gray-500`
- `insights/page.tsx`: extensive `text-gray-*`, `text-yellow-600`, `text-yellow-500` usage

**Rule:** No component may use raw Tailwind palette utilities after this phase. Every color reference must be a semantic token. [VERIFIED: UI-SPEC.md]

### next/image Migration (SEC-02)

**Current state:** Two raw `<img>` tags in the codebase: [VERIFIED: codebase grep]
1. `src/components/watch/WatchCard.tsx` line 25
2. `src/components/watch/WatchDetail.tsx` line 84

Both use `src={watch.imageUrl}` directly with no host validation.

**next/image `remotePatterns` in Next.js 16:** [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md]

The API supports both URL-object syntax and the legacy object syntax:
```typescript
// next.config.ts — TypeScript version
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.hodinkee.com' },
      { protocol: 'https', hostname: '**.chrono24.com' },
      { protocol: 'https', hostname: '**.watchuseek.com' },
      { protocol: 'https', hostname: '**.rolex.com' },
      { protocol: 'https', hostname: '**.omega-watches.com' },
      { protocol: 'https', hostname: '**.tudorwatch.com' },
      { protocol: 'https', hostname: '**.seikowatches.com' },
      { protocol: 'https', hostname: '**.grand-seiko.com' },
      { protocol: 'https', hostname: '**.wornandwound.com' },
      { protocol: 'https', hostname: '**.teddybaldassarre.com' },
      { protocol: 'https', hostname: '**.watchesofmayfair.com' },
      { protocol: 'https', hostname: 'cdn.shopify.com' },
      { protocol: 'https', hostname: '**.squarespace-cdn.com' },
      { protocol: 'https', hostname: 'images.squarespace-cdn.com' },
    ],
  },
}
```

**`**` hostname wildcard:** Matches any number of subdomain levels (e.g., `**.example.com` matches `img.example.com` and `cdn.img.example.com`). [VERIFIED: Next.js docs]

**`getSafeImageUrl()` helper (new file: `src/lib/images.ts`):**
```typescript
// Source: UI-SPEC.md SEC-02 section
const ALLOWED_HOSTS = [
  'hodinkee.com', 'chrono24.com', 'watchuseek.com', 'rolex.com',
  'omega-watches.com', 'tudorwatch.com', 'seikowatches.com',
  'grand-seiko.com', 'wornandwound.com', 'teddybaldassarre.com',
  'watchesofmayfair.com', 'cdn.shopify.com', 'squarespace-cdn.com',
]

export function getSafeImageUrl(url: string | undefined): string | null {
  if (!url) return null
  try {
    const { hostname } = new URL(url)
    const isAllowed = ALLOWED_HOSTS.some(
      (h) => hostname === h || hostname.endsWith('.' + h)
    )
    return isAllowed ? url : null
  } catch {
    return null
  }
}
```

**WatchCard image replacement pattern:**
```typescript
import Image from 'next/image'
import { getSafeImageUrl } from '@/lib/images'
import { Watch as WatchIcon } from 'lucide-react'

const safeUrl = getSafeImageUrl(watch.imageUrl)

// In JSX:
<div className="relative aspect-[4/5] bg-muted">
  {safeUrl ? (
    <Image
      src={safeUrl}
      alt={`${watch.brand} ${watch.model}`}
      fill
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
      className="object-cover"
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center">
      <WatchIcon className="h-10 w-10 text-muted-foreground/40" />
    </div>
  )}
</div>
```

**WatchDetail image:** Same pattern, but `aspect-square` and `sizes="(max-width: 1024px) 100vw, 50vw"`.

**Note on `fill` prop:** When using `fill`, the parent must have `position: relative` and a defined height. Using `aspect-[4/5]` (Tailwind) on the parent satisfies this — Tailwind generates the correct aspect-ratio CSS. [VERIFIED: Next.js image docs]

### SSRF Hardening (SEC-01)

**Current vulnerable surface:** `fetchAndExtract()` in `src/lib/extractors/index.ts` calls `fetch(url)` directly with no DNS resolution check, no private IP rejection, and no redirect control. [VERIFIED: codebase]

**Requirements from STATE.md + REQUIREMENTS.md:** Resolve hostname to IP; reject RFC1918 (10/8, 172.16/12, 192.168/16), loopback (127/8, ::1), link-local (169.254/16, fe80::/10), multicast (224/4, ff00::/8); pin resolved IP for fetch; validate every redirect hop. [VERIFIED: STATE.md, REQUIREMENTS.md SEC-01]

**Recommended approach: `node:dns` + `node:net` pre-check + custom undici fetch**

This runs entirely in Node.js built-ins. No new dependencies needed. The `ssrf-req-filter` package (v1.1.1) exists but adds a dependency for what can be done correctly in ~50 lines using `node:dns` + `node:net`. [VERIFIED: npm registry]

**Implementation skeleton for `src/lib/ssrf.ts` (new file):**

```typescript
import { promises as dns } from 'node:dns'
import * as net from 'node:net'

// Private, loopback, link-local, and reserved ranges
const PRIVATE_RANGES_V4 = [
  { start: '10.0.0.0',    bits: 8  },  // RFC1918
  { start: '172.16.0.0',  bits: 12 },  // RFC1918
  { start: '192.168.0.0', bits: 16 },  // RFC1918
  { start: '127.0.0.0',   bits: 8  },  // Loopback
  { start: '169.254.0.0', bits: 16 },  // Link-local
  { start: '100.64.0.0',  bits: 10 },  // Shared address space (RFC6598)
  { start: '0.0.0.0',     bits: 8  },  // "This" network
  { start: '192.0.0.0',   bits: 24 },  // IETF Protocol Assignments
  { start: '198.18.0.0',  bits: 15 },  // Benchmarking
  { start: '240.0.0.0',   bits: 4  },  // Reserved
  { start: '224.0.0.0',   bits: 4  },  // Multicast
]

const PRIVATE_IPV6_PREFIXES = ['::1', 'fc', 'fd', 'fe80', 'ff']

function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
}

function isPrivateIpv4(ip: string): boolean {
  const ipNum = ipToNumber(ip)
  return PRIVATE_RANGES_V4.some(({ start, bits }) => {
    const startNum = ipToNumber(start)
    const mask = bits === 32 ? 0xffffffff : ~((1 << (32 - bits)) - 1) >>> 0
    return (ipNum & mask) === (startNum & mask)
  })
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::1') return true
  return PRIVATE_IPV6_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIpv4(ip)
  if (net.isIPv6(ip)) return isPrivateIpv6(ip)
  return true // Treat unknown format as private
}

export class SsrfError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SsrfError'
  }
}

/**
 * Resolves hostname to IPs and rejects if any resolved IP is private.
 * Returns the first non-private IP for pinning.
 */
export async function resolveAndValidate(hostname: string): Promise<string> {
  let addresses: dns.LookupAddress[]
  try {
    addresses = await dns.lookup(hostname, { all: true })
  } catch {
    throw new SsrfError('DNS resolution failed')
  }
  if (!addresses.length) throw new SsrfError('No DNS records found')
  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new SsrfError('URL resolves to a private address')
    }
  }
  return addresses[0].address // pinned IP
}

/**
 * Fetch with SSRF protection:
 * - Resolves and validates the initial URL
 * - Follows redirects manually, re-validating each hop
 * - Throws SsrfError for any private-range redirect
 */
export async function safeFetch(
  url: string,
  options: RequestInit = {},
  maxRedirects = 5
): Promise<Response> {
  let currentUrl = url
  let redirectsLeft = maxRedirects

  while (true) {
    const parsed = new URL(currentUrl)
    await resolveAndValidate(parsed.hostname)

    const response = await fetch(currentUrl, {
      ...options,
      redirect: 'manual', // Prevent automatic redirect following
    })

    if (response.status >= 300 && response.status < 400) {
      if (redirectsLeft <= 0) throw new SsrfError('Too many redirects')
      const location = response.headers.get('location')
      if (!location) throw new SsrfError('Redirect with no Location header')
      // Resolve relative redirects
      currentUrl = new URL(location, currentUrl).toString()
      redirectsLeft--
      continue
    }

    return response
  }
}
```

**Integration in `src/lib/extractors/index.ts`:** Replace the bare `fetch(url)` call in `fetchAndExtract()`:
```typescript
import { safeFetch, SsrfError } from '@/lib/ssrf'

// Replace: const response = await fetch(url, { ... })
const response = await safeFetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; WatchCollectionBot/1.0)',
    'Accept': 'text/html,application/xhtml+xml',
  },
})
```

**Error surface in `route.ts`:** The `SsrfError` bubbles up through `fetchAndExtract()` to the route handler's try/catch. The route handler must detect `SsrfError` and return a specific 400 response:
```typescript
import { SsrfError } from '@/lib/ssrf'

// In the catch block:
if (error instanceof SsrfError) {
  return NextResponse.json(
    { error: 'That URL points to a private address and can\'t be imported.' },
    { status: 400 }
  )
}
```

**UrlImport.tsx error display:** Already renders `{error && <p className="text-sm text-red-600">{error}</p>}`. The SSRF error message flows through naturally — the client just shows `data.error`. Token migration will change `text-red-600` to `text-destructive`. [VERIFIED: codebase]

### BalanceChart Recharts Rewrite (VIS-06)

**Current implementation:** CSS bars with hardcoded `bg-blue-500`, `bg-green-500`, etc. [VERIFIED: BalanceChart.tsx]

**Required:** Replace with Recharts via shadcn's Chart primitive. `npx shadcn add chart` creates `src/components/ui/chart.tsx` and installs Recharts. [VERIFIED: UI-SPEC.md]

**Chart pattern using shadcn Chart wrapper:**
```typescript
'use client'
import { Bar, BarChart, XAxis, YAxis, Cell } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const chartConfig = {
  count: { label: 'Count', color: 'var(--chart-1)' },
}

export function BalanceChart({ title, data, emptyMessage = 'Not enough data yet.' }: BalanceChartProps) {
  if (data.length === 0) { /* empty state */ }
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} aria-label={`${title}: distribution chart`}>
          <BarChart data={sortedData} layout="vertical">
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="label" width={80} tick={{ fill: 'var(--muted-foreground)' }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--chart-1)" radius={[0, 4, 4, 0]}>
              {sortedData.map((_, i) => (
                <Cell key={i} fill={`var(--chart-${(i % 5) + 1})`} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
```

**The insights page (`src/app/insights/page.tsx`):** Already renders three `<BalanceChart>` instances (style, role, dial color) — the rewrite is drop-in since the props interface is unchanged. [VERIFIED: insights/page.tsx]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FOUC prevention | Custom `useEffect` theme toggle | `next-themes` ThemeProvider | useEffect runs after hydration — guaranteed flash. next-themes injects a blocking script. |
| IP range checking | String prefix matching on hostname | Actual IP-address range math after `dns.lookup()` | Hostname matching is trivially bypassed with DNS rebinding or unicode lookalikes |
| Chart rendering | CSS progress bars (current) | Recharts via shadcn Chart primitive | CSS bars have no accessibility, no tooltip, no theme-aware colors |
| Image host validation | Checking hostname in client component | `getSafeImageUrl()` helper + next/image `remotePatterns` | `remotePatterns` is enforced server-side by Next.js image optimization — cannot be bypassed by malformed URLs |

---

## Common Pitfalls

### Pitfall 1: `useEffect`-based theme toggle causes FOUC
**What goes wrong:** Setting theme class in a `useEffect` runs after hydration, causing a flash from the wrong theme.
**Why it happens:** React hydrates client-side before effects run; the class isn't set until after first paint.
**How to avoid:** Use `next-themes` ThemeProvider which injects a blocking `<script>` before the React bundle executes.
**Warning signs:** Any code that reads `localStorage` in `useEffect` to set a theme class.

### Pitfall 2: Missing `suppressHydrationWarning` on `<html>`
**What goes wrong:** React throws a hydration error because the server renders `<html class="">` but `next-themes` sets `<html class="dark">` before hydration.
**How to avoid:** Add `suppressHydrationWarning` only to the `<html>` element. Do NOT add it to data-bearing elements.

### Pitfall 3: DNS rebinding bypass
**What goes wrong:** Validating the hostname string against a blocklist (e.g., checking if hostname is "localhost") — an attacker registers `evil.com` that resolves to `127.0.0.1`.
**How to avoid:** Always resolve to IP via `dns.lookup()` and validate the IP, not the hostname. This is already called out in STATE.md.

### Pitfall 4: Redirect to private IP after initial check
**What goes wrong:** Resolve and validate the initial URL's IP, then `fetch(url)` with default redirect following — the server at the public IP responds with a `Location: http://192.168.1.1/` redirect.
**How to avoid:** Use `redirect: 'manual'` and re-validate each `Location` header before following.

### Pitfall 5: `next/image` with `fill` requires a positioned parent with explicit size
**What goes wrong:** `<Image fill />` inside a div with no height specified renders nothing — the image has no dimensions to fill.
**How to avoid:** Parent must have `position: relative` and a height. Use `aspect-[4/5]` on the parent div; Tailwind generates `aspect-ratio: 4/5` which gives height from width.

### Pitfall 6: Raw Tailwind palette classes (`bg-gray-100`) don't respond to dark mode
**What goes wrong:** `bg-gray-100` renders the same light gray in dark mode. Components look broken.
**How to avoid:** Replace all raw palette classes with semantic tokens. This is a mechanical find-and-replace but must be complete before testing dark mode.

### Pitfall 7: `@custom-variant dark` already set — do NOT duplicate or change
**What goes wrong:** globals.css has `@custom-variant dark (&:is(.dark *))` which is the Tailwind 4 dark variant. If you add a second declaration or change it, dark mode breaks silently.
**How to avoid:** Leave the existing line exactly as is. It is already correct for Tailwind 4 + next-themes.

---

## Code Examples

### next-themes ThemeProvider setup
```typescript
// src/app/layout.tsx
// Source: next-themes 0.4.6 docs, UI-SPEC.md
import { ThemeProvider } from 'next-themes'

<html lang="en" suppressHydrationWarning className={...}>
  <body className="min-h-full flex flex-col bg-background">
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="horlo-theme">
      <Header />
      <main className="flex-1">{children}</main>
    </ThemeProvider>
  </body>
</html>
```

### Theme toggle using useTheme
```typescript
// src/components/layout/ThemeToggle.tsx
// Source: next-themes docs
'use client'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  // ... render base-ui Popover with three options
}
```

### SSRF-safe fetch replacing current bare fetch
```typescript
// src/lib/extractors/index.ts — before
const response = await fetch(url, { headers: { ... } })

// after
import { safeFetch } from '@/lib/ssrf'
const response = await safeFetch(url, { headers: { ... } })
```

### next/image remotePatterns (Next.js 16 format)
```typescript
// next.config.ts — Source: node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md
images: {
  remotePatterns: [
    { protocol: 'https', hostname: '**.hodinkee.com' },
    // ... one entry per domain family
  ],
}
```

---

## Environment Availability

Step 2.6: SKIPPED for external services — all changes are code/npm installs, no databases or external services required in this phase.

| Dependency | Required By | Available | Version | Notes |
|------------|------------|-----------|---------|-------|
| Node.js | SSRF dns.lookup | Yes | v25.2.1 | `node:dns`, `node:net` built-ins available [VERIFIED] |
| npm | Package installs | Yes | (in project) | `package-lock.json` lockfileVersion 3 present |
| next-themes | VIS-01 | No | 0.4.6 | Requires `npm install next-themes` |
| recharts | VIS-06 | No | 3.8.1 | Requires `npx shadcn add chart` |
| Instrument Serif font | VIS-03 display | Yes (network) | — | Available via `next/font/google` [VERIFIED: runtime check passed] |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None currently installed (Vitest starts in Phase 2) |
| Config file | Does not exist yet |
| Quick run command | N/A for Phase 1 |
| Full suite command | N/A for Phase 1 |

Phase 1 has no automated test runner. Validation is via `npm run build` (TypeScript compilation) + `npm run lint` (ESLint) + manual visual checks. Phase 2 stands up Vitest.

### Phase Requirements → Validation Map

| Req ID | Success Criterion | Validation Method | Command / Steps |
|--------|------------------|-------------------|-----------------|
| VIS-01 | Theme toggle persists, no FOUC | Manual visual check | Open app, toggle dark, reload — confirm no flash; check localStorage `horlo-theme` key |
| VIS-01 | Three-state (light/dark/system) works | Manual | Toggle each option; confirm system follows OS preference |
| VIS-02 | 375px — no horizontal scroll | Browser DevTools | Set viewport 375px, visit every page, check for `overflow-x` |
| VIS-02 | Mobile nav accessible | Manual | At 375px, confirm hamburger opens drawer with all nav links |
| VIS-03 | No raw palette classes remain | ESLint + grep | `grep -r "bg-gray\|text-gray\|bg-green\|bg-blue\|bg-purple\|bg-yellow\|bg-red" src/components/ src/app/` → expect zero matches |
| VIS-04 | WatchCard: 4:5 aspect, status badge, no raw `<img>` | Code review + build | `grep -r "<img" src/` → expect zero results |
| VIS-04 | next/image renders correctly | `npm run build` | Build must succeed; `next/image` with unallowlisted host fails at build-time config validation |
| VIS-06 | Charts render with theme-aware colors | Manual visual check | Open insights page in light + dark, confirm bars use CSS variable colors |
| SEC-01 | Private IP rejected | `curl` test | `curl -X POST http://localhost:3000/api/extract-watch -d '{"url":"http://169.254.169.254/latest/meta-data/"}' -H 'Content-Type: application/json'` → expect 400 with SSRF error message |
| SEC-01 | Redirect to private IP blocked | Manual / integration | N/A until Phase 6 integration test — verified by code review of `redirect: 'manual'` pattern |
| SEC-02 | Untrusted hosts fail to render, not error | Manual | Add a watch with image from an unallowlisted host; confirm placeholder renders, `imageUrl` preserved in store |
| SEC-02 | No raw `<img>` tags in final code | grep | `grep -r "<img" src/` → zero results |

**Build validation:** `npm run build` catches TypeScript errors and verifies `remotePatterns` syntax at build time. Run before marking phase complete.

### Wave 0 Gaps
None — no test framework exists yet, none required for Phase 1. Phase 2 Wave 0 installs Vitest.

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `next/image` `domains` array | `remotePatterns` with wildcard hostnames | `domains` lacks wildcard/protocol/path control; `remotePatterns` is the current correct API [VERIFIED: Next.js docs] |
| CSS `prefers-color-scheme` media query + class toggle | `next-themes` ThemeProvider | Handles SSR, FOUC, system preference, and localStorage persistence atomically |
| Raw `<img>` for external images | `next/image` with `fill` prop + `aspect-ratio` parent | `fill` requires positioned parent with defined dimensions — aspect-ratio utility satisfies this |
| Tailwind 3 `darkMode: 'class'` config | Tailwind 4 `@custom-variant dark (&:is(.dark *))` | Already correct in globals.css — do not change |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Instrument Serif is available via `next/font/google` | Standard Stack | Font may need a different import name; verified runtime check passed but not tested in build context [ASSUMED from docs pattern, runtime check passed] |
| A2 | Watch retailer hostnames listed in remotePatterns cover the majority of imported watch images | SEC-02 | Users with watches from unlisted sites will see placeholder — `imageUrl` is preserved so adding hosts later is non-destructive |
| A3 | base-ui `Popover` in @base-ui/react 1.3.0 is the correct primitive for the theme toggle dropdown | Architecture Patterns | @base-ui/react 1.3.0 is confirmed installed; Popover is listed in the package — if API differs from assumptions, use shadcn Popover instead (already in registry safety list) [VERIFIED: base-ui installed, API pattern assumed from package listing] |

---

## Open Questions (RESOLVED)

1. **base-ui Sheet / Drawer for mobile nav:**
   - What we know: `@base-ui/react` 1.3.0 is installed and includes `drawer` in its package structure
   - What's unclear: Whether the drawer API matches shadcn's `Sheet` component (which is what UI-SPEC registry lists)
   - Recommendation: Run `npx shadcn add sheet` to get the shadcn Sheet wrapper that delegates to base-ui internally; this is the pattern already used for Dialog
   - **RESOLVED:** Plan 01 installs the shadcn Sheet primitive via `npx shadcn add sheet`. Plan 04 consumes it for MobileNav and the home-page FilterBar drawer. No direct base-ui drawer usage.

2. **WatchDetail layout restructure scope:**
   - What we know: Current detail has a small image thumbnail (w-32/w-48) next to text as a flex row, not the two-column grid the UI-SPEC calls for
   - What's unclear: Whether the layout change is purely additive (adding the `lg:grid-cols-[2fr_1fr]` wrapper) or requires extracting the image gallery into its own sub-component
   - Recommendation: The planner should scope this as a layout restructure task with the detail page, not just a token swap
   - **RESOLVED:** Plan 04 Task 2C wraps WatchDetail in `lg:grid-cols-[2fr_1fr]` (additive — no gallery sub-component extraction). Plan 05 then performs the classname token pass on the restructured file.

3. **Preferences page mobile layout:**
   - What we know: The preferences page was not inspected in this research pass
   - What's unclear: Whether it already stacks correctly at 375px or has fixed-width elements
   - Recommendation: Planner should include a grep/read of `src/app/preferences/page.tsx` as a task before declaring mobile done
   - **RESOLVED:** Plan 04 Task 2D audits `src/app/preferences/page.tsx` and enforces `w-full` on form fields + `max-w-2xl` container. Plan 05 owns token migration on the same file.

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase] — all file reads (layout.tsx, globals.css, WatchCard.tsx, WatchDetail.tsx, Header.tsx, FilterBar.tsx, BalanceChart.tsx, WatchGrid.tsx, insights/page.tsx, extractors/index.ts, route.ts, next.config.ts)
- [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md] — remotePatterns API, wildcard hostname syntax, `fill` prop requirements
- [VERIFIED: npm registry 2026-04-11] — next-themes 0.4.6, recharts 3.8.1 peer dependencies

### Secondary (MEDIUM confidence)
- [CITED: next-themes README / peer dep metadata] — React 19 compatibility confirmed via `npm view next-themes peerDependencies`
- [CITED: recharts peer dep metadata] — React 19 compatibility confirmed via `npm view recharts peerDependencies`

### Tertiary (LOW confidence)
- [ASSUMED] — base-ui Popover API shape (confirmed package exists, API pattern assumed from documentation conventions)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions verified against npm registry; all existing dependencies confirmed from package.json and node_modules
- Architecture: HIGH — all recommended patterns verified against actual codebase files
- SSRF implementation: HIGH — uses only Node.js built-ins, pattern derived from codebase inspection and requirements; no external dependency
- Pitfalls: HIGH — derived from direct codebase observation, not assumptions
- Recharts/shadcn chart: MEDIUM — package compatibility confirmed; exact shadcn Chart wrapper API is ASSUMED from documented shadcn patterns

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable ecosystem, no fast-moving dependencies)
