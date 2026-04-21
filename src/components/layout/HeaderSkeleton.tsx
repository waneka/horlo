// Fallback shown while <Header /> suspends on its auth / profile reads.
// Must match Header's outer sticky chrome + inner h-16 row to avoid CLS
// when the real header streams in.
export function HeaderSkeleton() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2 md:gap-8">
          <span className="font-serif text-xl">Horlo</span>
        </div>
      </div>
    </header>
  )
}
