'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { savePreferences } from '@/app/actions/preferences'
import { useFormFeedback } from '@/lib/hooks/useFormFeedback'
import { FormStatusBanner } from '@/components/ui/FormStatusBanner'
import {
  STYLE_TAGS,
  DESIGN_TRAITS,
  COMPLICATIONS,
  DIAL_COLORS,
} from '@/lib/constants'
import type { UserPreferences } from '@/lib/types'

// Narrow to only those keys of UserPreferences whose value type is a
// string array. A refactor adding a string-valued field will no longer
// compile through toggleArrayItem, removing the runtime-cast footgun.
type StringArrayKeys = NonNullable<
  {
    [K in keyof UserPreferences]: UserPreferences[K] extends string[] ? K : never
  }[keyof UserPreferences]
>

interface PreferencesClientProps {
  preferences: UserPreferences
  /**
   * Phase 23 D-04 — when true, suppresses the page-chrome (outer container,
   * <h1>Preferences</h1>, subtitle paragraph) so this client can be embedded
   * inside <PreferencesSection> on the Settings tab. Default false preserves
   * the byte-identical render path for the standalone /preferences route
   * (Phase 22 D-15 redirect makes that hypothetical, but the prop default
   * protects future intent).
   */
  embedded?: boolean
}

export function PreferencesClient({
  preferences: initialPreferences,
  embedded = false,
}: PreferencesClientProps) {
  // Local mirror of preferences for responsive UI. Every mutation calls the
  // savePreferences Server Action, which upserts the row and revalidates
  // '/preferences'. The Server Component re-renders with fresh data on next
  // navigation — this local state only bridges the gap between input change
  // and server confirmation.
  const [preferences, setLocalPreferences] = useState<UserPreferences>(initialPreferences)
  // Phase 25 / UX-06 — hybrid toast + banner via shared hook (D-17). Hook
  // owns the transition; consumers MUST NOT keep their own (FG-8).
  const { pending, state, message, run } = useFormFeedback()

  const updatePreferences = (patch: Partial<UserPreferences>) => {
    const next = { ...preferences, ...patch }
    setLocalPreferences(next)
    // Inspect the returned ActionResult so save failures are not silently swallowed (MR-01).
    // We do NOT roll back the local optimistic update here — the Server Component's
    // revalidatePath('/preferences') in savePreferences runs only on success, so the next
    // navigation naturally reconciles local state with server truth. The hook surfaces
    // a Sonner toast + inline FormStatusBanner on either outcome (D-16/D-18).
    run(() => savePreferences(patch), { successMessage: 'Preferences saved' })
  }

  const toggleArrayItem = (field: StringArrayKeys, item: string) => {
    const currentArray = preferences[field]
    const newArray = currentArray.includes(item)
      ? currentArray.filter((i) => i !== item)
      : [...currentArray, item]
    updatePreferences({ [field]: newArray } as Partial<UserPreferences>)
  }

  const CASE_SIZE_MIN = 20
  const CASE_SIZE_MAX = 55
  const clampCaseSize = (n: number) =>
    Math.max(CASE_SIZE_MIN, Math.min(CASE_SIZE_MAX, n))

  const inner = (
    <div className="space-y-8">
        {/* Phase 25 UX-06 — hybrid toast + aria-live banner (D-16/D-17). The
            hook's `pending` is the canonical in-flight signal; resolved
            success/error states flow through `state`. */}
        <FormStatusBanner
          state={pending ? 'pending' : state}
          message={message ?? undefined}
        />
        {/* Style Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Style Preferences</CardTitle>
            <CardDescription>
              What types of watches do you gravitate toward? (diver, dress, field, etc.)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-sm font-semibold mb-3 block">
                Preferred Styles
              </Label>
              <div className="flex flex-wrap gap-4">
                {STYLE_TAGS.map((tag) => (
                  <label
                    key={tag}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={preferences.preferredStyles.includes(tag)}
                      onCheckedChange={() =>
                        toggleArrayItem('preferredStyles', tag)
                      }
                    />
                    <span className="text-sm capitalize">{tag}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-3 block">
                Disliked Styles
              </Label>
              <div className="flex flex-wrap gap-4">
                {STYLE_TAGS.map((tag) => (
                  <label
                    key={tag}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={preferences.dislikedStyles.includes(tag)}
                      onCheckedChange={() =>
                        toggleArrayItem('dislikedStyles', tag)
                      }
                    />
                    <span className="text-sm capitalize">{tag}</span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Design Trait Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Design Preferences</CardTitle>
            <CardDescription>
              What visual and aesthetic characteristics appeal to you?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-sm font-semibold mb-3 block">
                Preferred Traits
              </Label>
              <div className="flex flex-wrap gap-4">
                {DESIGN_TRAITS.map((trait) => (
                  <label
                    key={trait}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={preferences.preferredDesignTraits.includes(trait)}
                      onCheckedChange={() =>
                        toggleArrayItem('preferredDesignTraits', trait)
                      }
                    />
                    <span className="text-sm capitalize">{trait}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-3 block">
                Disliked Traits
              </Label>
              <div className="flex flex-wrap gap-4">
                {DESIGN_TRAITS.map((trait) => (
                  <label
                    key={trait}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={preferences.dislikedDesignTraits.includes(trait)}
                      onCheckedChange={() =>
                        toggleArrayItem('dislikedDesignTraits', trait)
                      }
                    />
                    <span className="text-sm capitalize">{trait}</span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Complication Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Complication Preferences</CardTitle>
            <CardDescription>
              Which complications do you prefer? Exception complications are
              always allowed even if they would normally cause overlap.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-sm font-semibold mb-3 block">
                Preferred Complications
              </Label>
              <div className="flex flex-wrap gap-4">
                {COMPLICATIONS.map((comp) => (
                  <label
                    key={comp}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={preferences.preferredComplications.includes(comp)}
                      onCheckedChange={() =>
                        toggleArrayItem('preferredComplications', comp)
                      }
                    />
                    <span className="text-sm capitalize">{comp}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-3 block">
                Exception Complications (Always Allowed)
              </Label>
              <div className="flex flex-wrap gap-4">
                {COMPLICATIONS.map((comp) => (
                  <label
                    key={comp}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={preferences.complicationExceptions.includes(comp)}
                      onCheckedChange={() =>
                        toggleArrayItem('complicationExceptions', comp)
                      }
                    />
                    <span className="text-sm capitalize">{comp}</span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dial Color Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Dial Color Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-sm font-semibold mb-3 block">
                Preferred Colors
              </Label>
              <div className="flex flex-wrap gap-4">
                {DIAL_COLORS.map((color) => (
                  <label
                    key={color}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={preferences.preferredDialColors.includes(color)}
                      onCheckedChange={() =>
                        toggleArrayItem('preferredDialColors', color)
                      }
                    />
                    <span className="text-sm capitalize">{color}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-3 block">
                Disliked Colors
              </Label>
              <div className="flex flex-wrap gap-4">
                {DIAL_COLORS.map((color) => (
                  <label
                    key={color}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={preferences.dislikedDialColors.includes(color)}
                      onCheckedChange={() =>
                        toggleArrayItem('dislikedDialColors', color)
                      }
                    />
                    <span className="text-sm capitalize">{color}</span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Case Size Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Case Size Preferences</CardTitle>
            <CardDescription>
              Your preferred case size range (mm)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 w-full sm:max-w-xs">
              <div className="space-y-2">
                <Label htmlFor="minSize">Min Size</Label>
                <Input
                  id="minSize"
                  type="number"
                  min={CASE_SIZE_MIN}
                  max={CASE_SIZE_MAX}
                  value={preferences.preferredCaseSizeRange?.min ?? ''}
                  onChange={(e) => {
                    // Leave prior value on empty input so mid-keystroke
                    // clears don't silently reset the range to the floor.
                    if (e.target.value === '') return
                    const parsed = Number(e.target.value)
                    if (!Number.isFinite(parsed)) return
                    const nextMin = clampCaseSize(parsed)
                    const currentMax =
                      preferences.preferredCaseSizeRange?.max ?? 46
                    // Only commit if min <= max; otherwise ignore until
                    // the user produces a valid pair.
                    if (nextMin > currentMax) return
                    updatePreferences({
                      preferredCaseSizeRange: {
                        min: nextMin,
                        max: currentMax,
                      },
                    })
                  }}
                  placeholder="36"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxSize">Max Size</Label>
                <Input
                  id="maxSize"
                  type="number"
                  min={CASE_SIZE_MIN}
                  max={CASE_SIZE_MAX}
                  value={preferences.preferredCaseSizeRange?.max ?? ''}
                  onChange={(e) => {
                    if (e.target.value === '') return
                    const parsed = Number(e.target.value)
                    if (!Number.isFinite(parsed)) return
                    const nextMax = clampCaseSize(parsed)
                    const currentMin =
                      preferences.preferredCaseSizeRange?.min ?? 34
                    if (nextMax < currentMin) return
                    updatePreferences({
                      preferredCaseSizeRange: {
                        min: currentMin,
                        max: nextMax,
                      },
                    })
                  }}
                  placeholder="42"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Range: 20mm – 55mm</p>
          </CardContent>
        </Card>

        {/* Phase 23 D-02: the engine-knob Selects were lifted to two
            dedicated top-of-tab Cards inside <PreferencesSection> so they
            sit above the taste-tag pickers per SET-07 / SET-08. */}

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
            <CardDescription>
              Any other notes about your collecting taste or preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={preferences.notes ?? ''}
              onChange={(e) => updatePreferences({ notes: e.target.value })}
              placeholder="Describe your collecting philosophy..."
              rows={4}
            />
          </CardContent>
        </Card>
      </div>
    )

  if (embedded) return inner

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl md:text-4xl text-foreground">Preferences</h1>
        <p className="text-muted-foreground mt-2">
          Configure your collecting taste to get personalized insights.
        </p>
      </div>
      {inner}
    </div>
  )
}
