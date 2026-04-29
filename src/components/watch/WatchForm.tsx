'use client'

import { useState, useTransition } from 'react'
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
import { UrlImport } from './UrlImport'
import { CatalogPhotoUploader } from './CatalogPhotoUploader'
import { addWatch, editWatch } from '@/app/actions/watches'
import type { ExtractedWatchData } from '@/lib/extractors'
import {
  COMPLICATIONS,
  DIAL_COLORS,
  MOVEMENT_TYPES,
  STRAP_TYPES,
  CRYSTAL_TYPES,
  WATCH_STATUSES,
} from '@/lib/constants'
import type { Watch, WatchStatus, MovementType, StrapType, CrystalType } from '@/lib/types'

interface WatchFormProps {
  watch?: Watch
  mode: 'create' | 'edit'
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
  notes: '',
  imageUrl: '',
}

export function WatchForm({ watch, mode }: WatchFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [submitError, setSubmitError] = useState<string | null>(null)

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
          status: watch.status,
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
          notes: watch.notes ?? '',
          imageUrl: watch.imageUrl ?? '',
        }
      : initialFormData
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

    setSubmitError(null)
    startTransition(async () => {
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
            setSubmitError('Authentication expired. Please sign in again.')
            return
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
      const submitData = { ...formData, ...(photoSourcePath ? { photoSourcePath } : {}) }

      const result =
        mode === 'edit' && watch
          ? await editWatch(watch.id, formData)
          : await addWatch(submitData)

      if (result.success) {
        router.push('/')
      } else {
        setSubmitError(result.error)
      }
    })
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

  const handleUrlImport = (data: ExtractedWatchData) => {
    setFormData((prev) => ({
      ...prev,
      brand: data.brand || prev.brand,
      model: data.model || prev.model,
      reference: data.reference || prev.reference,
      movement: data.movement || prev.movement,
      complications: data.complications?.length ? data.complications : prev.complications,
      caseSizeMm: data.caseSizeMm ?? prev.caseSizeMm,
      lugToLugMm: data.lugToLugMm ?? prev.lugToLugMm,
      waterResistanceM: data.waterResistanceM ?? prev.waterResistanceM,
      strapType: data.strapType || prev.strapType,
      crystalType: data.crystalType || prev.crystalType,
      dialColor: data.dialColor || prev.dialColor,
      styleTags: data.styleTags?.length ? data.styleTags : prev.styleTags,
      designTraits: data.designTraits?.length ? data.designTraits : prev.designTraits,
      isChronometer: data.isChronometer ?? prev.isChronometer,
      marketPrice: data.marketPrice ?? prev.marketPrice,
      imageUrl: data.imageUrl || prev.imageUrl,
    }))
  }

  const isOwned = formData.status === 'owned'

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* URL Import - only show in create mode */}
      {mode === 'create' && (
        <UrlImport onDataExtracted={handleUrlImport} />
      )}

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
          disabled={isPending}
        />
      )}

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.notes}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, notes: e.target.value }))
            }
            placeholder="Any additional notes about this watch..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      {submitError && (
        <p className="text-sm text-destructive text-right">{submitError}</p>
      )}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending
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
