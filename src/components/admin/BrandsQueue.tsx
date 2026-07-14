'use client'

/**
 * Phase 82 Plan 04 — BrandsQueue
 *
 * Client shell for /admin/brands. Renders the needs_review brand queue as Card rows
 * with Confirm / Rename / Merge inline actions. Mirrors ListIndexClient.tsx L145-220.
 *
 * Memory guardrails:
 *   - [[accent-is-active-token]]: selected radio uses bg-accent (warm amber, not the harsh primary fill)
 *   - [[button-medium-guardrail]]: use font-semibold for all emphasized text (medium is prohibited)
 *   - [[assert-disappearance-too]]: merge dialog tests assert both mount AND unmount
 *   - [[router-cache-stale-instance]]: deep-link useEffect fires once on mount (acceptable)
 *   - [[next16-revalidatetag-deprecated]]: revalidatePath used, NOT updateTag
 *
 * RESEARCH Pitfall 7: brands prop NOT copied to useState — router.refresh() drives re-render
 * from the Server Component re-fetch. No optimistic local list copy.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandPicker } from '@/components/watch/BrandPicker'
import { confirmBrandAsNew, renameBrand, mergeBrand } from '@/app/actions/cms/brands'
import type { BrandRow } from '@/data/brands'

interface BrandsQueueProps {
  /** Pre-sorted needs_review DESC, name ASC — from listBrandsForQueue(). Includes familyCount. */
  brands: BrandRow[]
  /** Full brand list for the merge-target picker — from listBrands(). */
  allBrands: { id: string; name: string }[]
}

export function BrandsQueue({ brands, allBrands }: BrandsQueueProps) {
  const router = useRouter()

  // Rename dialog state
  const [renameTarget, setRenameTarget] = useState<BrandRow | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Merge dialog state
  const [mergeTarget, setMergeTarget] = useState<BrandRow | null>(null)
  const [mergeTargetPick, setMergeTargetPick] = useState<{ id: string; name: string } | null>(null)
  // D-82-12: default to moving all families (pre-flight radio default)
  const [mergeMoveFamilies, setMergeMoveFamilies] = useState(true)

  // Action in-flight tracker: stores the brand id currently being actioned
  const [busy, setBusy] = useState<string | null>(null)

  // Deep-link scroll + 1s highlight (UI-SPEC §Deep-Link Scroll L305-320)
  // Per [[router-cache-stale-instance]]: fires once on mount with empty deps.
  // The WatchForm "Edit brand" link → /admin/brands navigation always fresh-mounts.
  useEffect(() => {
    const hash = window.location.hash // '#brand-{id}'
    if (!hash.startsWith('#brand-')) return
    const id = hash.slice('#brand-'.length)
    const el = document.getElementById(`brand-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.dataset.highlighted = 'true'
      const timer = setTimeout(() => {
        delete el.dataset.highlighted
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  async function handleConfirm(id: string) {
    setBusy(id)
    const result = await confirmBrandAsNew({ id })
    setBusy(null)
    if (!result.success) {
      toast.error(result.error ?? 'Failed')
      return
    }
    toast.success('Brand confirmed.')
    router.refresh()
  }

  async function handleRename() {
    if (!renameTarget) return
    setBusy(renameTarget.id)
    const result = await renameBrand({ id: renameTarget.id, name: renameValue.trim() })
    setBusy(null)
    if (!result.success) {
      toast.error(result.error ?? 'Failed')
      return
    }
    toast.success('Brand renamed.')
    setRenameTarget(null)
    setRenameValue('')
    router.refresh()
  }

  async function handleMerge() {
    if (!mergeTarget || !mergeTargetPick) return
    setBusy(mergeTarget.id)
    const result = await mergeBrand({
      sourceId: mergeTarget.id,
      targetId: mergeTargetPick.id,
      moveFamilies: mergeMoveFamilies,
    })
    setBusy(null)
    if (!result.success) {
      toast.error(result.error ?? 'Failed')
      return
    }
    toast.success('Brand merged.')
    setMergeTarget(null)
    setMergeTargetPick(null)
    setMergeMoveFamilies(true)
    router.refresh()
  }

  // Empty state
  if (brands.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">No brands need review.</p>
    )
  }

  return (
    <>
      {/* Queue rows */}
      <div className="space-y-3">
        {brands.map((brand) => (
          <Card
            key={brand.id}
            id={`brand-${brand.id}`}
            data-testid={`brand-row-${brand.id}`}
            className="data-[highlighted=true]:bg-accent/30 dark:data-[highlighted=true]:bg-accent/20 transition-colors duration-300"
          >
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                {/* Metadata */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold truncate">{brand.name}</span>
                    {brand.needsReview && (
                      <Badge variant="secondary">needs review</Badge>
                    )}
                  </div>
                  {brand.countryOfOrigin && (
                    <p className="text-xs text-muted-foreground">{brand.countryOfOrigin}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                  {brand.needsReview && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleConfirm(brand.id)}
                      disabled={busy === brand.id}
                    >
                      {busy === brand.id ? (
                        <Loader2 className="animate-spin" aria-hidden="true" />
                      ) : (
                        'Confirm as new'
                      )}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRenameTarget(brand)
                      setRenameValue(brand.name)
                    }}
                    disabled={busy === brand.id}
                  >
                    Rename brand
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setMergeTarget(brand)
                      setMergeTargetPick(null)
                      setMergeMoveFamilies(true)
                    }}
                    disabled={busy === brand.id}
                  >
                    Merge into…
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rename dialog */}
      <Dialog
        open={!!renameTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null)
            setRenameValue('')
          }
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Rename {renameTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="rename-brand-input">Name</Label>
            <Input
              id="rename-brand-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Keep current name</DialogClose>
            <Button
              variant="default"
              onClick={handleRename}
              disabled={busy === renameTarget?.id || renameValue.trim() === ''}
            >
              {busy === renameTarget?.id ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Renaming…
                </>
              ) : (
                'Rename brand'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge dialog — target picker + pre-flight radiogroup (D-82-12) */}
      <Dialog
        open={!!mergeTarget}
        onOpenChange={(open) => {
          if (!open) {
            setMergeTarget(null)
            setMergeTargetPick(null)
            setMergeMoveFamilies(true)
          }
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Merge {mergeTarget?.name} into…</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {/* Merge-target picker — reuses BrandPicker without onCouldntFind (D-82-10) */}
            <BrandPicker
              brands={allBrands.filter((b) => b.id !== mergeTarget?.id)}
              value={mergeTargetPick}
              onChange={setMergeTargetPick}
            />

            {/* Pre-flight radiogroup — fires when source has ≥1 families (D-82-12) */}
            {(mergeTarget?.familyCount ?? 0) > 0 && (
              <div role="radiogroup" aria-label="Family handling" className="grid gap-2">
                <p className="text-sm text-muted-foreground">
                  Source brand has {mergeTarget!.familyCount} families. Merging will move all
                  families to target. Continue?
                </p>
                <label
                  className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer ${
                    mergeMoveFamilies
                      ? 'bg-accent text-accent-foreground dark:bg-accent dark:text-accent-foreground'
                      : ''
                  }`}
                >
                  <input
                    type="radio"
                    role="radio"
                    name="moveFamilies"
                    checked={mergeMoveFamilies}
                    onChange={() => setMergeMoveFamilies(true)}
                  />
                  Move all {mergeTarget!.familyCount} families to target
                </label>
                <label
                  className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer ${
                    !mergeMoveFamilies
                      ? 'bg-accent text-accent-foreground dark:bg-accent dark:text-accent-foreground'
                      : ''
                  }`}
                >
                  <input
                    type="radio"
                    role="radio"
                    name="moveFamilies"
                    checked={!mergeMoveFamilies}
                    onChange={() => setMergeMoveFamilies(false)}
                  />
                  Cancel — resolve families first
                </label>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel merge</DialogClose>
            <Button
              variant="destructive"
              onClick={handleMerge}
              disabled={
                !mergeTargetPick ||
                busy === mergeTarget?.id ||
                // If source has families and operator chose "Cancel", block the merge CTA
                ((mergeTarget?.familyCount ?? 0) > 0 && !mergeMoveFamilies)
              }
            >
              {busy === mergeTarget?.id ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Merging…
                </>
              ) : mergeTargetPick ? (
                `Merge into ${mergeTargetPick.name}`
              ) : (
                'Merge brands'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
