'use client'

/**
 * Phase 82 Plan 05 — FamiliesQueue
 *
 * Client shell for /admin/families. Renders the needs_review family queue as Card rows
 * with Confirm / Rename / Add-alias inline actions. Mirrors ListIndexClient.tsx L145-220
 * and BrandsQueue.tsx (Plan 04) for the overall shape.
 *
 * OPS-02 scope per D-82-10: rename + add-alias + confirm ONLY. No family merge.
 *
 * Memory guardrails:
 *   - [[space-y-inline-block-siblings]]: alias chip strip uses flex flex-wrap gap-2 (NOT space-y-*)
 *   - [[accent-is-active-token]]: no selected-state primary fills
 *   - [[button-medium-guardrail]]: use font-semibold (not the medium weight)
 *   - [[button-outline-dark-override]]: no unpaired bg-* overrides on outline Button
 *   - [[assert-disappearance-too]]: dialog tests assert both mount AND unmount
 *   - [[next16-revalidatetag-deprecated]]: revalidatePath used, NOT updateTag
 *
 * RESEARCH Pitfall 7: families prop NOT copied to useState — router.refresh() drives
 * re-render from the Server Component re-fetch. No optimistic local list copy.
 *
 * T-82-P05-03: alias chip strip inside the dialog derives currentAliases from the FRESH
 * families prop (not from captured aliasTarget snapshot) so router.refresh() reflects
 * in the open dialog.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { X, Loader2 } from 'lucide-react'
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
import {
  confirmFamilyAsNew,
  renameFamily,
  addFamilyAlias,
  removeFamilyAlias,
} from '@/app/actions/cms/families'
import type { FamilyRow } from '@/data/families'

interface FamiliesQueueProps {
  /** Pre-sorted needs_review DESC, name ASC — from listFamiliesForQueue(). */
  families: FamilyRow[]
  /** Validated UUID from ?brandId= param, or null if absent/invalid. */
  brandIdFilter: string | null
  /** Brand name for the filter banner copy; null when no filter active. */
  filterBrandName: string | null
}

export function FamiliesQueue({ families, brandIdFilter, filterBrandName }: FamiliesQueueProps) {
  const router = useRouter()

  // Rename dialog state
  const [renameTarget, setRenameTarget] = useState<FamilyRow | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Alias dialog state
  const [aliasTarget, setAliasTarget] = useState<FamilyRow | null>(null)
  const [newAlias, setNewAlias] = useState('')

  // Action in-flight tracker — compound key for alias remove: `${familyId}:${alias}`
  const [busy, setBusy] = useState<string | null>(null)

  async function handleConfirm(id: string) {
    setBusy(id)
    const result = await confirmFamilyAsNew({ id })
    setBusy(null)
    if (!result.success) {
      toast.error(result.error ?? 'Failed')
      return
    }
    toast.success('Family confirmed.')
    router.refresh()
  }

  async function handleRename() {
    if (!renameTarget) return
    setBusy(renameTarget.id)
    const result = await renameFamily({ id: renameTarget.id, name: renameValue.trim() })
    setBusy(null)
    if (!result.success) {
      toast.error(result.error ?? 'Failed')
      return
    }
    toast.success('Family renamed.')
    setRenameTarget(null)
    setRenameValue('')
    router.refresh()
  }

  async function handleAddAlias() {
    if (!aliasTarget) return
    setBusy(aliasTarget.id)
    const result = await addFamilyAlias({ id: aliasTarget.id, alias: newAlias.trim() })
    setBusy(null)
    if (!result.success) {
      toast.error(result.error ?? 'Failed')
      return
    }
    // No toast on add — minor non-destructive action per UI-SPEC L282-284
    setNewAlias('')
    router.refresh()
  }

  async function handleRemoveAlias(familyId: string, alias: string) {
    setBusy(`${familyId}:${alias}`)
    const result = await removeFamilyAlias({ id: familyId, alias })
    setBusy(null)
    if (!result.success) {
      toast.error(result.error ?? 'Failed')
      return
    }
    toast.success('Alias removed.')
    router.refresh()
  }

  // T-82-P05-03: derive current aliases from FRESH families prop (not captured aliasTarget snapshot)
  // so router.refresh() after add/remove reflects in the open dialog without re-opening it.
  const currentAliasFamily = aliasTarget ? families.find((f) => f.id === aliasTarget.id) : null
  const currentAliases = currentAliasFamily?.aliases ?? []

  return (
    <>
      {/* Filter banner — UI-SPEC L330-331 */}
      {brandIdFilter && filterBrandName && (
        <p className="text-sm text-muted-foreground mb-4">
          Showing families of {filterBrandName}.{' '}
          <Link href="/admin/families" className="underline">
            Clear filter.
          </Link>
        </p>
      )}

      {/* Empty state */}
      {families.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No families need review.</p>
      ) : (
        <div className="space-y-3">
          {families.map((family) => (
            <Card
              key={family.id}
              id={`family-${family.id}`}
              data-testid={`row-family-${family.id}`}
            >
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  {/* Metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold truncate">{family.name}</span>
                      {family.needsReview && (
                        <Badge variant="secondary">needs review</Badge>
                      )}
                      {family.brandName && (
                        <span className="text-xs text-muted-foreground">· {family.brandName}</span>
                      )}
                    </div>
                    {/* Inline alias chips on the row */}
                    {family.aliases && family.aliases.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {family.aliases.map((alias) => (
                          <Badge key={alias} variant="secondary">
                            {alias}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 shrink-0">
                    {family.needsReview && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleConfirm(family.id)}
                        disabled={busy === family.id}
                      >
                        {busy === family.id ? (
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
                        setRenameTarget(family)
                        setRenameValue(family.name)
                      }}
                      disabled={busy === family.id}
                    >
                      Rename family
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAliasTarget(family)
                        setNewAlias('')
                      }}
                      disabled={busy === family.id}
                    >
                      Add alias
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
            <Label htmlFor="rename-family-input">Name</Label>
            <Input
              id="rename-family-input"
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
                'Rename family'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add-Alias dialog (D-82-11) */}
      <Dialog
        open={!!aliasTarget}
        onOpenChange={(open) => {
          if (!open) {
            setAliasTarget(null)
            setNewAlias('')
          }
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Aliases for {aliasTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {/* Chip strip — flex flex-wrap gap-2 per [[space-y-inline-block-siblings]] */}
            {currentAliases.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {currentAliases.map((alias) => (
                  <Badge key={alias} variant="secondary" className="flex items-center gap-1 pr-1">
                    {alias}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove alias ${alias}`}
                      onClick={() => aliasTarget && handleRemoveAlias(aliasTarget.id, alias)}
                      disabled={busy === `${aliasTarget?.id}:${alias}`}
                      className="ml-1 h-4 w-4 p-0"
                    >
                      <X className="size-3" aria-hidden="true" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}

            {/* New alias input */}
            <div className="grid gap-2">
              <Label htmlFor="new-alias-input">New alias</Label>
              <Input
                id="new-alias-input"
                placeholder="e.g., submariner"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newAlias.trim()) handleAddAlias()
                }}
              />
              <Button
                size="sm"
                variant="default"
                onClick={handleAddAlias}
                disabled={busy === aliasTarget?.id || newAlias.trim() === ''}
              >
                {busy === aliasTarget?.id ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    Adding…
                  </>
                ) : (
                  'Add alias'
                )}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Close aliases</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
