import { toast } from 'sonner'

/**
 * Phase 85 LIFE-04 / D-09 / D-10 / D-11 / D-12 — the promotion celebration.
 *
 * Called from the two D-09 promotion paths (AddWatchFlow's "Move to
 * collection" and WatchForm's edit-save branch) once the server has returned
 * `promoted: true` on its `ActionResult<WatchEditResult>` — never on the
 * client's own guess. Both call sites fire this BEFORE their existing
 * `router.push` so the moment survives the soft navigation: sonner's toast
 * lives in a portal outside the route tree, and canvas-confetti paints to a
 * `<canvas>` appended directly to `document.body`, so neither is torn down
 * by the page transition and no destination-page mount effect is needed
 * (sidesteps the Next 16 Router Cache stale-instance-restoration gotcha).
 *
 * D-12: pure celebration — the toast asks for nothing (no action button, no
 * price-paid prompt, no photo link).
 *
 * Under the reduced-motion media query (checked below) the confetti burst is
 * skipped but the toast still shows.
 */
export async function celebratePromotion(
  promotedFrom: 'wishlist' | 'grail' | null
): Promise<void> {
  toast.success(promotedFrom === 'grail' ? 'Grail acquired!' : 'Added to your collection!')

  try {
    if (
      typeof window !== 'undefined' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      const { default: confetti } = await import('canvas-confetti')
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
    }
  } catch (error) {
    // Celebration is non-critical — never let a confetti load failure block
    // the caller's subsequent navigation.
    console.error('celebratePromotion: confetti failed', error)
  }
}
