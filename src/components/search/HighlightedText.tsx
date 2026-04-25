'use client'

import { Fragment } from 'react'

/**
 * Phase 16 D-15 match highlighting.
 *
 * XSS-safe: bio is user-controlled untrusted text (Pitfall T-16-02 stored XSS).
 * NEVER bypasses React's text-escaping. Builds a React node array via
 * String.split with a case-insensitive regex; matched substrings wrapped in
 * <strong>, others emitted as plain text Fragments (so `<script>...` in bio
 * appears as TEXT, not parsed HTML).
 *
 * Regex metachar escape (Pitfall T-16-05): user query may contain regex
 * metacharacters like `(`, `.`, `*`, `\`. Escape before constructing the regex
 * to prevent both runtime errors and ReDoS-style pathological patterns.
 *
 * Highlight style: <strong className="font-semibold text-foreground">. Per
 * Pitfall 7 in research, <mark> is rejected because its UA-default yellow
 * background fights theme tokens; <strong> with font-weight bump is the
 * lightest-touch visual signal that respects light/dark mode.
 */
export function HighlightedText({ text, q }: { text: string; q: string }) {
  const trimmedQ = q.trim()
  if (!trimmedQ) return <>{text}</>

  // Pitfall T-16-05: escape regex metacharacters before constructing the regex
  const escapedQ = trimmedQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(${escapedQ})`, 'gi')

  const parts = text.split(re)
  const lowerQ = trimmedQ.toLowerCase()
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === lowerQ ? (
          <strong key={i} className="font-semibold text-foreground">
            {part}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}
