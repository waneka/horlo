'use client'

// D-11: Search-as-you-type catalog watch picker.
//
// A debounced Input (200ms) that calls searchCatalogForPicker server action.
// Renders a positioned dropdown of brand + model + reference rows.
// Already-added watches appear disabled with a check icon.
// Selecting a watch fires onSelect(catalogId) and clears the input.
// Min query length: 2 characters.

import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { searchCatalogForPicker } from '@/app/actions/cms/catalogPicker'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'
import { cn } from '@/lib/utils'

export interface WatchPickerProps {
  /** IDs of catalog watches already added (shown disabled with a check icon). */
  addedCatalogIds?: string[]
  /** Called when the user selects a result row. */
  onSelect: (catalogId: string) => void
  placeholder?: string
  disabled?: boolean
}

export function WatchPicker({
  addedCatalogIds = [],
  onSelect,
  placeholder = 'Search watches…',
  disabled = false,
}: WatchPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchCatalogWatchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounced search: 200ms, min 2 chars.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    const trimmed = query.trim()

    // Schedule the search (or clear state) after the debounce window.
    timerRef.current = setTimeout(async () => {
      if (trimmed.length < 2) {
        setResults([])
        setOpen(false)
        return
      }
      setLoading(true)
      const result = await searchCatalogForPicker(trimmed)
      setLoading(false)
      if (result.success) {
        setResults(result.data)
        setOpen(true)
      }
    }, 200)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query])

  // Close dropdown on outside click.
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  function handleSelect(catalogId: string) {
    onSelect(catalogId)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-8"
          aria-label={placeholder}
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-md overflow-y-auto"
          style={{ maxHeight: '240px' }}
        >
          {results.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              No matches
            </div>
          ) : (
            results.map((r) => {
              const alreadyAdded = addedCatalogIds.includes(r.catalogId)
              return (
                <button
                  key={r.catalogId}
                  role="option"
                  aria-selected={alreadyAdded}
                  type="button"
                  disabled={alreadyAdded}
                  onClick={() => !alreadyAdded && handleSelect(r.catalogId)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-sm text-left',
                    alreadyAdded
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-muted cursor-pointer',
                  )}
                >
                  {alreadyAdded && (
                    <Check className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span className="truncate">
                    {r.brand} {r.model}
                    {r.reference ? ` · ${r.reference}` : ''}
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
