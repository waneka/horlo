'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePreferencesStore } from '@/store/preferencesStore'
import {
  STYLE_TAGS,
  DESIGN_TRAITS,
  COMPLICATIONS,
  DIAL_COLORS,
} from '@/lib/constants'
import type { OverlapTolerance, CollectionGoal } from '@/lib/types'

export default function PreferencesPage() {
  const { preferences, updatePreferences } = usePreferencesStore()

  const toggleArrayItem = (
    field: keyof typeof preferences,
    item: string
  ) => {
    const currentArray = preferences[field] as string[]
    const newArray = currentArray.includes(item)
      ? currentArray.filter((i) => i !== item)
      : [...currentArray, item]
    updatePreferences({ [field]: newArray })
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl md:text-4xl text-foreground">Preferences</h1>
        <p className="text-muted-foreground mt-2">
          Configure your collecting taste to get personalized insights.
        </p>
      </div>

      <div className="space-y-8">
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
                  min={20}
                  max={55}
                  value={preferences.preferredCaseSizeRange?.min ?? ''}
                  onChange={(e) =>
                    updatePreferences({
                      preferredCaseSizeRange: {
                        min: e.target.value ? Number(e.target.value) : 20,
                        max: preferences.preferredCaseSizeRange?.max ?? 46,
                      },
                    })
                  }
                  placeholder="36"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxSize">Max Size</Label>
                <Input
                  id="maxSize"
                  type="number"
                  min={20}
                  max={55}
                  value={preferences.preferredCaseSizeRange?.max ?? ''}
                  onChange={(e) =>
                    updatePreferences({
                      preferredCaseSizeRange: {
                        min: preferences.preferredCaseSizeRange?.min ?? 34,
                        max: e.target.value ? Number(e.target.value) : 46,
                      },
                    })
                  }
                  placeholder="42"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Range: 20mm – 55mm</p>
          </CardContent>
        </Card>

        {/* Collection Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Collection Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 w-full sm:max-w-xs">
              <Label htmlFor="overlapTolerance">Overlap Tolerance</Label>
              <Select
                value={preferences.overlapTolerance}
                onValueChange={(value) => {
                  if (value) {
                    updatePreferences({ overlapTolerance: value as OverlapTolerance })
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    Low - Flag any overlap
                  </SelectItem>
                  <SelectItem value="medium">
                    Medium - Flag significant overlap
                  </SelectItem>
                  <SelectItem value="high">
                    High - Only flag major overlap
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 w-full sm:max-w-xs">
              <Label htmlFor="collectionGoal">Collection Goal</Label>
              <Select
                value={preferences.collectionGoal ?? ''}
                onValueChange={(value) => {
                  updatePreferences({ collectionGoal: (value || undefined) as CollectionGoal | undefined })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a goal..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balanced">
                    Balanced - Diverse collection
                  </SelectItem>
                  <SelectItem value="specialist">
                    Specialist - Deep in one area
                  </SelectItem>
                  <SelectItem value="variety-within-theme">
                    Variety within theme
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

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
    </div>
  )
}
