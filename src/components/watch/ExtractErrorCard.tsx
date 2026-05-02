'use client'

/**
 * Phase 25 Plan 02 — ExtractErrorCard
 *
 * Categorized URL-extract error display for `<AddWatchFlow>`'s
 * `extraction-failed` state (D-11..D-15). Pure presentational component:
 * takes `category`, optional `message`, and the two recovery callbacks.
 * No routing logic, no state, no side effects — wiring lives in 25-04.
 *
 * Copy is LOCKED per D-15 — the five body strings in CONTRACT_BY_CATEGORY
 * are reproduced verbatim from UI-SPEC §"<ExtractErrorCard> Per-Category
 * Copy" and MUST NOT be paraphrased. Headings are LOCKED per UI-SPEC
 * §Copywriting Contract.
 *
 * Icon set is LOCKED per D-14 (UI-SPEC Anti-Pattern #9): only the five
 * lucide icons listed below may appear in this component.
 *
 * Callback stability (T-25-02-03): callers (25-04) should pass stable
 * callbacks via `useCallback` to avoid effect-loops in any future consumer
 * that observes the props. This component itself does NOT depend on the
 * callbacks in any useEffect / useMemo, so unstable callbacks here are
 * inert; the note is for caller hygiene.
 *
 * Information disclosure (T-25-02-01): the optional `message` prop is
 * dev-only (rendered only when `process.env.NODE_ENV !== 'production'`)
 * and never reaches end-users in production. The locked D-15 body copy
 * is the user-visible recovery surface; `message` is debug-grade.
 */

import { Lock, FileQuestion, Clock, Gauge, WifiOff, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

export type ExtractErrorCategory =
  | 'host-403'
  | 'structured-data-missing'
  | 'LLM-timeout'
  | 'quota-exceeded'
  | 'generic-network'

export interface ExtractErrorCardProps {
  category: ExtractErrorCategory
  /**
   * Optional verbatim error message from the route (debug-grade; not
   * user-facing). Rendered as a small dev-only detail beneath the body.
   * NEVER replaces the LOCKED D-15 body copy.
   */
  message?: string
  /**
   * Resets `<AddWatchFlow>` state to `{ kind: 'idle' }` with the URL
   * input cleared. Caller's responsibility to wrap in `useCallback`.
   */
  retryAction: () => void
  /**
   * Navigates to `/watch/new?manual=1`. Caller's responsibility to wrap
   * in `useCallback`. Component does NOT construct URLs from props
   * (open-redirect mitigation T-25-02-02).
   */
  manualAction: () => void
}

interface CategoryContract {
  Icon: LucideIcon
  heading: string
  body: string
}

// LOCKED per UI-SPEC §Per-category contract (D-14 + D-15).
// DO NOT paraphrase any string in this map. DO NOT swap any icon.
const CONTRACT_BY_CATEGORY: Record<ExtractErrorCategory, CategoryContract> = {
  'host-403': {
    Icon: Lock,
    heading: 'This site blocks data extraction',
    body: "This site doesn't allow data extraction. Try entering manually.",
  },
  'structured-data-missing': {
    Icon: FileQuestion,
    heading: 'No watch info found',
    body: "Couldn't find watch info on this page. Try the original product page or enter manually.",
  },
  'LLM-timeout': {
    Icon: Clock,
    heading: 'Extraction timed out',
    body: 'Extraction is taking longer than expected. Try again or enter manually.',
  },
  'quota-exceeded': {
    Icon: Gauge,
    heading: 'Service is busy',
    body: 'Extraction service is busy. Try again in a few minutes.',
  },
  'generic-network': {
    Icon: WifiOff,
    heading: "Couldn't reach that URL",
    body: "Couldn't reach that URL. Check the link and try again.",
  },
}

export function ExtractErrorCard({
  category,
  message,
  retryAction,
  manualAction,
}: ExtractErrorCardProps) {
  const { Icon, heading, body } = CONTRACT_BY_CATEGORY[category]

  return (
    <div
      role="alert"
      aria-live="polite"
      className="mt-4 flex items-start gap-3 rounded-xl border border-l-2 border-border border-l-destructive bg-card p-4"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{heading}</p>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        {message && process.env.NODE_ENV !== 'production' && (
          <p className="mt-1 text-xs text-muted-foreground/60">{message}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="default" size="sm" onClick={manualAction}>
            Add manually
          </Button>
          <Button variant="outline" size="sm" onClick={retryAction}>
            Try a different URL
          </Button>
        </div>
      </div>
    </div>
  )
}
