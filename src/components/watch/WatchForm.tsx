'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CatalogPhotoUploader } from './CatalogPhotoUploader'
import { addWatch, editWatch } from '@/app/actions/watches'
import { useFormFeedback } from '@/lib/hooks/useFormFeedback'
import { FormStatusBanner } from '@/components/ui/FormStatusBanner'
import {
  COMPLICATIONS,
  DIAL_COLORS,
  MOVEMENT_TYPES,
  STRAP_TYPES,
  CRYSTAL_TYPES,
  WATCH_STATUSES,
} from '@/lib/constants'
import type { Watch, WatchStatus, MovementType, StrapType, CrystalType } from '@/lib/types'
import { cn } from '@/lib/utils'

interface WatchFormProps {
  watch?: Watch
  mode: 'create' | 'edit'
  /** Phase 20.1 D-12: when set, the status field is locked to this value
   *  and rendered as a read-only chip (no Select). The verdict step's
   *  3-button decision IS the status decision in this flow. */
  lockedStatus?: WatchStatus
  /** Phase 25 D-05: when set (and `lockedStatus` is NOT set), this value
   *  seeds the initial status field but the user can still change it.
   *  Used by the manual-entry path coming from `/watch/new?status=wishlist`
   *  so the form opens pre-set to wishlist. */
  defaultStatus?: WatchStatus
}

type FormData = Omit<Watch, 'id'>

const initialFormData: FormData = {
  brand: '',
  model: '',
  reference: '',
  status: 'wishlist',
  pricePaid: undefined,
  targetPrice: undefined,
  marketPrice: undefined,
  movement: 'automatic',
  complications: [],
  caseSizeMm: undefined,
  lugToLugMm: undefined,
  waterResistanceM: undefined,
  strapType: undefined,
  crystalType: undefined,
  dialColor: undefined,
  styleTags: [],
  designTraits: [],
  roleTags: [],
  acquisitionDate: undefined,
  productionYear: undefined,
  isFlaggedDeal: undefined,
  isChronometer: false,    // Phase 23 D-09 — default unchecked for new watches
  notes: '',
  notesPublic: true,       // Phase 23 D-13/D-16 — matches DB default; non-negotiable
  imageUrl: '',
}

export function WatchForm({ watch, mode, lockedStatus, defaultStatus }: WatchFormProps) {
  const router = useRouter()
  // Phase 25 / UX-06 — hybrid toast + banner via shared hook (D-17). Hook
  // owns the transition; consumers MUST NOT keep their own (FG-8). The hook's
  // `message` carries the error string when a Server Action returns
  // ActionResult.success === false (replaces the prior local error state).
  const { pending, state, message, run } = useFormFeedback()

  // Phase 19.1 D-19: optional Reference Photo (manual-entry-only).
  // Stores the EXIF-stripped, ≤1080px JPEG blob in state until form submit.
  // Plan 05 reads this state in handleSubmit and uploads to catalog-source-photos.
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)

  const [formData, setFormData] = useState<FormData>(
    watch
      ? {
          brand: watch.brand,
          model: watch.model,
          reference: watch.reference ?? '',
          status: lockedStatus ?? defaultStatus ?? watch.status,
          pricePaid: watch.pricePaid,
          targetPrice: watch.targetPrice,
          marketPrice: watch.marketPrice,
          movement: watch.movement,
          complications: watch.complications,
          caseSizeMm: watch.caseSizeMm,
          lugToLugMm: watch.lugToLugMm,
          waterResistanceM: watch.waterResistanceM,
          strapType: watch.strapType,
          crystalType: watch.crystalType,
          dialColor: watch.dialColor,
          styleTags: watch.styleTags,
          designTraits: watch.designTraits,
          roleTags: watch.roleTags,
          acquisitionDate: watch.acquisitionDate,
          productionYear: watch.productionYear,
          isFlaggedDeal: watch.isFlaggedDeal,
          isChronometer: watch.isChronometer ?? false,    // Phase 23 D-09
          notes: watch.notes ?? '',
          notesPublic: watch.notesPublic ?? true,         // Phase 23 D-13 — defensive ?? true defends legacy rows
          imageUrl: watch.imageUrl ?? '',
        }
      : {
          ...initialFormData,
          status: lockedStatus ?? defaultStatus ?? initialFormData.status,
        }
  )

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.brand.trim()) {
      newErrors.brand = 'Brand is required'
    }
    if (!formData.model.trim()) {
      newErrors.model = 'Model is required'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    // LOCKED per UI-SPEC §Default copy contract — both literals are
    // referenced by SUMMARY grep gates; split onto separate lines so each
    // gate matches its own occurrence.
    const successMessage =
      mode === 'edit'
        ? 'Watch updated'
        : 'Watch added'

    run(async () => {
      // Phase 19.1 D-19: if a photo is staged (create mode only), upload to
      // catalog-source-photos BEFORE calling addWatch. The bucket path is passed
      // to addWatch as photoSourcePath; server-side enricher reads the bucket via
      // signed URL (vision mode per D-08).
      let photoSourcePath: string | undefined = undefined
      if (mode === 'create' && photoBlob) {
        try {
          // Get the current user id via the browser Supabase client.
          // Same approach used by the wearPhotos upload helper (Phase 15).
          const { createSupabaseBrowserClient } = await import('@/lib/supabase/client')
          const supabase = createSupabaseBrowserClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            return {
              success: false as const,
              error: 'Authentication expired. Please sign in again.',
            }
          }

          const { uploadCatalogSourcePhoto } = await import('@/lib/storage/catalogSourcePhotos')
          const uploadResult = await uploadCatalogSourcePhoto(user.id, 'pending', photoBlob)
          if ('path' in uploadResult) {
            photoSourcePath = uploadResult.path
          } else {
            // Photo upload failed — proceed without photo per D-09 fire-and-forget posture.
            // Watch submission is not blocked by photo upload failure.
            console.error('[WatchForm] photo upload failed:', uploadResult.error)
          }
        } catch (err) {
          console.error('[WatchForm] photo upload exception (non-fatal):', err)
        }
      }

      // Strip client-only blob state from formData before sending to server.
      // photoSourcePath is a transient submit-only payload extension — not a Watch field.
      // Phase 20.1 D-12 defense: ensure lockedStatus wins even if formData.status drifted (e.g., HMR).
      const finalStatus: WatchStatus = lockedStatus ?? formData.status
      const submitData = {
        ...formData,
        status: finalStatus,
        ...(photoSourcePath ? { photoSourcePath } : {}),
      }

      const result =
        mode === 'edit' && watch
          ? await editWatch(watch.id, formData)
          : await addWatch(submitData)

      if (result.success) {
        // router.push fires before run() resolves; the hook's setState happens
        // on the next tick + Sonner's portal-mounted toast persists across the
        // navigation, so the user sees `successMessage` after landing on `/`.
        // The form unmounts mid-nav, so the inline FormStatusBanner does NOT
        // render post-nav — toast is the canonical post-add affordance here.
        router.push('/')
      }
      return result
    }, { successMessage })
  }

  const toggleArrayItem = (
    field: 'styleTags' | 'designTraits' | 'roleTags' | 'complications',
    item: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter((i) => i !== item)
        : [...prev[field], item],
    }))
  }

  const isOwned = formData.status === 'owned'

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="brand">Brand *</Label>
            <Input
              id="brand"
              value={formData.brand}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, brand: e.target.value }))
              }
              placeholder="e.g., Omega"
            />
            {errors.brand && (
              <p className="text-sm text-destructive">{errors.brand}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Model *</Label>
            <Input
              id="model"
              value={formData.model}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, model: e.target.value }))
              }
              placeholder="e.g., Speedmaster"
            />
            {errors.model && (
              <p className="text-sm text-destructive">{errors.model}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Reference Number</Label>
            <Input
              id="reference"
              value={formData.reference}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, reference: e.target.value }))
              }
              placeholder="e.g., 311.30.42.30.01.005"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status *</Label>
            {lockedStatus ? (
              // Phase 20.1 D-12: status decision was made in the verdict step;
              // render a read-only chip rather than a Select.
              <div
                id="status"
                aria-readonly="true"
                className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm capitalize"
              >
                {lockedStatus}
              </div>
            ) : (
              <Select
                value={formData.status}
                onValueChange={(value) => {
                  if (!value) return
                  setFormData((prev) => ({ ...prev, status: value as WatchStatus }))
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WATCH_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      <span className="capitalize">{status}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input
              id="imageUrl"
              type="url"
              value={formData.imageUrl}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))
              }
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="marketPrice">Market/Retail</Label>
            <Input
              id="marketPrice"
              type="number"
              value={formData.marketPrice ?? ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  marketPrice: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
              placeholder="$"
            />
          </div>

          {isOwned ? (
            <div className="space-y-2">
              <Label htmlFor="pricePaid">Paid</Label>
              <Input
                id="pricePaid"
                type="number"
                value={formData.pricePaid ?? ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    pricePaid: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                placeholder="$"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="targetPrice">Target</Label>
              <Input
                id="targetPrice"
                type="number"
                value={formData.targetPrice ?? ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    targetPrice: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                placeholder="$"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Specifications */}
      <Card>
        <CardHeader>
          <CardTitle>Specifications</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="movement">Movement *</Label>
            <Select
              value={formData.movement}
              onValueChange={(value) => {
                if (value) {
                  setFormData((prev) => ({ ...prev, movement: value as MovementType }))
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOVEMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    <span className="capitalize">{type}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="caseSizeMm">Case Size (mm)</Label>
            <Input
              id="caseSizeMm"
              type="number"
              value={formData.caseSizeMm ?? ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  caseSizeMm: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
              placeholder="e.g., 42"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lugToLugMm">Lug-to-Lug (mm)</Label>
            <Input
              id="lugToLugMm"
              type="number"
              value={formData.lugToLugMm ?? ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  lugToLugMm: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
              placeholder="e.g., 48"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productionYear">Production year</Label>
            <Input
              id="productionYear"
              type="number"
              min={1900}
              max={2100}
              step={1}
              value={formData.productionYear ?? ''}
              onChange={(e) => {
                const v = e.target.value
                setFormData((prev) => ({
                  ...prev,
                  productionYear: v === '' ? undefined : Number(v),
                }))
              }}
              placeholder="e.g. 2022"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="waterResistanceM">Water Resistance (m)</Label>
            <Input
              id="waterResistanceM"
              type="number"
              value={formData.waterResistanceM ?? ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  waterResistanceM: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
              placeholder="e.g., 100"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="strapType">Strap Type</Label>
            <Select
              value={formData.strapType ?? ''}
              onValueChange={(value) => {
                setFormData((prev) => ({ ...prev, strapType: (value || undefined) as StrapType | undefined }))
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {STRAP_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    <span className="capitalize">{type}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="crystalType">Crystal</Label>
            <Select
              value={formData.crystalType ?? ''}
              onValueChange={(value) => {
                setFormData((prev) => ({ ...prev, crystalType: (value || undefined) as CrystalType | undefined }))
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {CRYSTAL_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    <span className="capitalize">{type}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dialColor">Dial Color</Label>
            <Select
              value={formData.dialColor ?? ''}
              onValueChange={(value) => {
                setFormData((prev) => ({ ...prev, dialColor: value || undefined }))
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {DIAL_COLORS.map((color) => (
                  <SelectItem key={color} value={color}>
                    <span className="capitalize">{color}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Phase 23 FEAT-08 — Chronometer certification (D-10).
              Full-width row spanning all grid columns at every breakpoint. */}
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={formData.isChronometer === true}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isChronometer: checked === true }))
                }
              />
              <span className="text-sm">
                Chronometer-certified <span className="text-muted-foreground">(COSC or equivalent)</span>
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Complications */}
      <Card>
        <CardHeader>
          <CardTitle>Complications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {COMPLICATIONS.map((complication) => (
              <label
                key={complication}
                className="flex items-center space-x-2 cursor-pointer"
              >
                <Checkbox
                  checked={formData.complications.includes(complication)}
                  onCheckedChange={() =>
                    toggleArrayItem('complications', complication)
                  }
                />
                <span className="text-sm capitalize">{complication}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Phase 19.1 D-19: Reference Photo (create mode only — UI-SPEC.md §Component Inventory) */}
      {mode === 'create' && (
        <CatalogPhotoUploader
          onPhotoReady={(blob) => {
            setPhotoBlob(blob)
            setPhotoError(null)
          }}
          onClear={() => setPhotoBlob(null)}
          onError={(message) => setPhotoError(message)}
          disabled={pending}
        />
      )}

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={formData.notes}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, notes: e.target.value }))
            }
            placeholder="Any additional notes about this watch..."
            rows={4}
          />
          {/* Phase 23 FEAT-07 — note visibility pill (D-13/D-14/D-16).
              Mirrors NoteVisibilityPill styling exactly; uses local form state
              (deferred-commit, not optimistic). Default Public (D-16). */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Visibility:</span>
            <button
              type="button"
              role="switch"
              aria-checked={formData.notesPublic === true}
              aria-label={
                formData.notesPublic === true
                  ? 'Note is public, click to make private'
                  : 'Note is private, click to make public'
              }
              onClick={() =>
                setFormData((prev) => ({ ...prev, notesPublic: !(prev.notesPublic === true) }))
              }
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-normal transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                formData.notesPublic === true
                  ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70',
              )}
            >
              {formData.notesPublic === true ? 'Public' : 'Private'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {/* Phase 25 UX-06 — hybrid feedback (D-16/D-17). Banner mounted ABOVE
          the submit row so error copy stays visible while the user retries.
          On success, navigation unmounts the form — toast is the canonical
          post-add/edit affordance. */}
      <FormStatusBanner
        state={pending ? 'pending' : state}
        message={message ?? undefined}
      />
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending
            ? mode === 'create'
              ? 'Adding...'
              : 'Saving...'
            : mode === 'create'
              ? 'Add Watch'
              : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
