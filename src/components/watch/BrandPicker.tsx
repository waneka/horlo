'use client'

/**
 * Phase 82 Plan 02 — BrandPicker
 *
 * Dedicated brand typeahead built on @base-ui/react/combobox 1.3.0, mirroring
 * SearchEntry's controlled-open pattern (SearchEntry.tsx L207–338).
 *
 * Props:
 *   brands        — SSR-fetched { id, name }[] list (D-82-02; full list, client filters)
 *   value         — controlled selected brand (null when unselected)
 *   onChange      — fires with { id, name } on brand selection
 *   onCouldntFind — (optional) fires with trimmed typed string when zero matches
 *                   and user clicks the UI-02 affordance. Merge dialog omits this.
 *
 * UI-01: Client-side substring filter — zero round-trips post SSR-fetch (D-82-02).
 * UI-02: "Couldn't find that brand" affordance — placed as SIBLING of Combobox.List
 *        inside Combobox.Popup per SRCH-03 lesson. NEVER inside the list (click swallow).
 *        The affordance button is a plain <button type="button"> sibling — not a
 *        list-primitive — so native click semantics are preserved in real browsers.
 *
 * Memory guardrails:
 *   - [[accent-is-active-token]]: data-[highlighted]:bg-accent (NOT bg-primary)
 *   - [[button-medium-guardrail]]: no font-medium anywhere in this file
 *   - [[assert-disappearance-too]]: affordance click calls onCouldntFind + setOpen(false)
 */

import { useState, useMemo } from 'react'
import { Combobox } from '@base-ui/react/combobox'

type Brand = { id: string; name: string }

export interface BrandPickerProps {
  brands: Brand[]
  value: Brand | null
  onChange: (next: Brand) => void
  /** Optional — omit in merge dialog (Plan 04). When provided, shows UI-02 affordance
   *  on zero-match results. Fires with trimmed typed value on click. */
  onCouldntFind?: (typed: string) => void
  /** Optional — forwards to Combobox.Input; gates the picker during extraction. */
  disabled?: boolean
}

export function BrandPicker({
  brands,
  value,
  onChange,
  onCouldntFind,
  disabled,
}: BrandPickerProps) {
  // Seed inputValue from current value's name so a pre-selected brand shows its name.
  const [inputValue, setInputValue] = useState(value?.name ?? '')
  const [open, setOpen] = useState(false)

  // D-82-02 — client-side substring filter; no per-keystroke round-trip
  const filteredBrands = useMemo(
    () =>
      brands.filter((b) =>
        b.name.toLowerCase().includes(inputValue.toLowerCase().trim()),
      ),
    [brands, inputValue],
  )

  return (
    <Combobox.Root<Brand>
      inputValue={inputValue}
      onInputValueChange={(val, details) => {
        // Mirror SearchEntry L214-218 — ignore non-input-change reasons (e.g.
        // `inputClear` on popup close, `triggerPress`) that would clobber the
        // user's typed value before the next render.
        if (details.reason !== 'input-change') return
        setInputValue(val)
      }}
      filteredItems={filteredBrands}
      filter={null} // MUST be paired with filteredItems — disables base-ui's internal match
      itemToStringLabel={(b) => b.name}
      itemToStringValue={(b) => b.id}
      isItemEqualToValue={(a, b) => a.id === b.id}
      onValueChange={(picked) => {
        if (picked) onChange(picked)
      }}
      open={open}
      onOpenChange={(next) => setOpen(next)}
      value={value}
    >
      <Combobox.Input
        aria-label="Search brands"
        placeholder="Search brands…"
        disabled={disabled}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
      />

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} align="start">
          <Combobox.Popup className="z-50 w-[var(--anchor-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
            {filteredBrands.length > 0 && (
              <Combobox.List className="max-h-[60vh] overflow-y-auto p-1">
                {filteredBrands.map((b) => (
                  <Combobox.Item
                    key={b.id}
                    value={b}
                    className="group flex items-center gap-4 min-w-0 rounded-md pl-2 pr-3 py-2 cursor-default data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                  >
                    {b.name}
                  </Combobox.Item>
                ))}
              </Combobox.List>
            )}

            {/* UI-02 affordance: SIBLING of <Combobox.List> — placed OUTSIDE the
                listbox role so native click semantics apply. SRCH-03 lesson: buttons
                inside the listbox context have their clicks intercepted by base-ui's
                keyboard/pointer management. See SearchEntry.tsx L325–334 for the
                canonical pattern this mirrors. Gate: zero matches + non-empty typed
                + onCouldntFind provided (merge dialog omits the prop). */}
            {filteredBrands.length === 0 &&
              inputValue.trim().length > 0 &&
              onCouldntFind && (
                <button
                  type="button"
                  data-testid="brand-picker-couldnt-find"
                  onClick={() => {
                    onCouldntFind(inputValue.trim())
                    setOpen(false)
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
                >
                  {"Couldn't find that brand — add as “"}{inputValue.trim()}{'”'}
                </button>
              )}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
