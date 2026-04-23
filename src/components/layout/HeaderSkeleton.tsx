/**
 * Fallback shown while <Header /> suspends on its auth / profile reads.
 *
 * Renders TWO skeleton strips — one per breakpoint — so neither SlimTopNav
 * (mobile-only, height 3rem) nor DesktopTopNav (desktop-only, height 4rem)
 * cause Cumulative Layout Shift when the real nav streams in (Pitfall P-09).
 */
export function HeaderSkeleton() {
  return (
    <>
      {/* Mobile skeleton — matches SlimTopNav dimensions */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur md:hidden">
        <div className="container mx-auto flex h-12 items-center justify-between px-4">
          <span className="font-serif text-xl">Horlo</span>
        </div>
      </header>
      {/* Desktop skeleton — matches DesktopTopNav dimensions */}
      <header className="sticky top-0 z-50 hidden w-full border-b border-border bg-background/80 backdrop-blur md:block">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <span className="font-serif text-xl">Horlo</span>
        </div>
      </header>
    </>
  )
}
