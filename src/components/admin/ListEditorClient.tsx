'use client'

// Full curated-list editor.
//
// Sections (top-to-bottom per UI-SPEC §List Editor):
//   - Hero-pin control (when published)
//   - Title + Curator-name inputs
//   - Cover image (CmsCoverUploader)
//   - Intro copy (MarkdownEditor)
//   - Watch items (WatchPicker + per-item commentary + reorder + remove)
//   - Save Draft / Publish / Unpublish controls
//   - Delete (with border-t divider)
//
// D-06: FK-RESTRICT deletes surface a destructive toast.
// D-12: up/down reorder buttons (no drag-and-drop).
// D-13: MarkdownEditor for intro copy.
// D-14/D-15: CmsCoverUploader (16:9, object-cover, no crop).
// CMS-06: Publish disabled when item count = 0 + Tooltip.
// CMS-08: Hero-pin dialog with optional expiry.

import { startTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronUp, ChevronDown, X, Loader2, Pin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { WatchPicker } from '@/components/admin/WatchPicker'
import { MarkdownEditor } from '@/components/admin/MarkdownEditor'
import { CmsCoverUploader } from '@/components/admin/CmsCoverUploader'
import {
  updateCuratedList,
  deleteCuratedList,
  addWatchToList,
  updateListItemCommentary,
  removeWatchFromList,
  moveListItemUp,
  moveListItemDown,
  publishCuratedList,
  unpublishCuratedList,
} from '@/app/actions/cms/curatedLists'
import { setPinnedHero, clearPinnedHero } from '@/app/actions/cms/settings'
import { toast } from 'sonner'

type ListItem = {
  id: string
  listId: string
  catalogId: string
  commentary: string | null
  sortOrder: number
  createdAt: Date
}

type CuratedList = {
  id: string
  title: string
  curatorName: string
  coverUrl: string | null | undefined
  introMarkdown: string | null | undefined
  status: 'draft' | 'published'
  sortOrder: number
  createdAt: Date
  updatedAt: Date
  items: ListItem[]
}

interface ListEditorClientProps {
  list: CuratedList
  isPinned: boolean
}

const FK_RESTRICT_ERROR =
  "Can't delete — this watch is used in a list or path. Remove it from all lists and paths first."

function isFkRestrictError(error: string | undefined): boolean {
  if (!error) return false
  return (
    error.includes('restrict') ||
    error.includes('foreign key') ||
    error.includes('referenced') ||
    error.includes('FK')
  )
}

export function ListEditorClient({ list: initialList, isPinned: initialIsPinned }: ListEditorClientProps) {
  const router = useRouter()
  const [list, setList] = useState<CuratedList>(initialList)
  const [isPinned, setIsPinned] = useState(initialIsPinned)

  // Form field state
  const [title, setTitle] = useState(initialList.title)
  const [curatorName, setCuratorName] = useState(initialList.curatorName)
  const [introMarkdown, setIntroMarkdown] = useState(initialList.introMarkdown ?? '')
  const [coverUrl, setCoverUrl] = useState(initialList.coverUrl ?? '')

  // UI state
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showPinDialog, setShowPinDialog] = useState(false)
  const [pinExpiry, setPinExpiry] = useState('')
  const [pinning, setPinning] = useState(false)
  const [reorderingItemId, setReorderingItemId] = useState<string | null>(null)
  const [removingItemId, setRemovingItemId] = useState<string | null>(null)

  const items = list.items
  const addedCatalogIds = items.map((i) => i.catalogId)

  function refresh() {
    router.refresh()
  }

  // ---- Save Draft ----
  async function handleSaveDraft() {
    setSaving(true)
    startTransition(async () => {
      const result = await updateCuratedList({
        id: list.id,
        title: title.trim() || 'Untitled List',
        curatorName: curatorName.trim() || 'Curator',
        introMarkdown: introMarkdown || null,
        coverUrl: coverUrl || null,
      })
      setSaving(false)
      if (!result.success) {
        toast.error("Couldn't save changes. Try again.")
      } else {
        toast.success('Draft saved.')
        refresh()
      }
    })
  }

  // ---- Publish / Unpublish ----
  async function handlePublish() {
    setPublishing(true)
    const result = await publishCuratedList(list.id)
    setPublishing(false)
    if (!result.success) {
      toast.error(result.error ?? "Couldn't publish list. Try again.")
    } else {
      toast.success('List published.')
      setList((prev) => ({ ...prev, status: 'published' }))
      refresh()
    }
  }

  async function handleUnpublish() {
    setPublishing(true)
    const result = await unpublishCuratedList(list.id)
    setPublishing(false)
    if (!result.success) {
      toast.error("Couldn't unpublish list. Try again.")
    } else {
      toast.success('List unpublished.')
      setList((prev) => ({ ...prev, status: 'draft' }))
      refresh()
    }
  }

  // ---- Delete ----
  async function handleDelete() {
    setDeleting(true)
    const result = await deleteCuratedList(list.id)
    setDeleting(false)
    setShowDeleteDialog(false)
    if (!result.success) {
      toast.error(isFkRestrictError(result.error) ? FK_RESTRICT_ERROR : "Couldn't delete list. Try again.")
    } else {
      router.push('/admin/lists')
    }
  }

  // ---- Watch items ----
  async function handleAddWatch(catalogId: string) {
    const result = await addWatchToList({ listId: list.id, catalogId })
    if (!result.success) {
      toast.error(result.error ?? "Couldn't add watch to list. Try again.")
    } else {
      refresh()
    }
  }

  async function handleUpdateCommentary(itemId: string, commentary: string) {
    const result = await updateListItemCommentary({ itemId, commentary: commentary || null })
    if (!result.success) {
      toast.error("Couldn't update commentary. Try again.")
    }
  }

  async function handleRemoveWatch(itemId: string) {
    setRemovingItemId(itemId)
    const result = await removeWatchFromList(itemId)
    setRemovingItemId(null)
    if (!result.success) {
      toast.error(isFkRestrictError(result.error) ? FK_RESTRICT_ERROR : "Couldn't remove watch. Try again.")
    } else {
      refresh()
    }
  }

  async function handleMoveItem(itemId: string, direction: 'up' | 'down') {
    setReorderingItemId(itemId)
    const action = direction === 'up' ? moveListItemUp : moveListItemDown
    const result = await action(itemId)
    setReorderingItemId(null)
    if (!result.success) {
      toast.error("Couldn't reorder item. Try again.")
    } else {
      refresh()
    }
  }

  // ---- Hero pin ----
  async function handlePin() {
    setPinning(true)
    const expiresAt = pinExpiry ? new Date(pinExpiry).toISOString() : null
    const result = await setPinnedHero({ listId: list.id, expiresAt })
    setPinning(false)
    setShowPinDialog(false)
    if (!result.success) {
      toast.error("Couldn't pin hero. Try again.")
    } else {
      toast.success('Pinned as hero.')
      setIsPinned(true)
    }
  }

  async function handleClearPin() {
    const result = await clearPinnedHero()
    if (!result.success) {
      toast.error("Couldn't clear hero pin. Try again.")
    } else {
      toast.success('Hero pin cleared.')
      setIsPinned(false)
    }
  }

  const canPublish = items.length > 0

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">{title || 'Untitled List'}</h1>

      {/* Hero-pin control — CMS-08, only when published */}
      {list.status === 'published' && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
          {isPinned ? (
            <>
              <Badge variant="default">
                <Pin className="size-3 mr-1" aria-hidden="true" />
                Pinned as Hero
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearPin}
              >
                Clear Pin
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPinDialog(true)}
            >
              Pin as Hero
            </Button>
          )}
        </div>
      )}

      {/* Metadata fields */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="list-title" className="font-semibold text-muted-foreground">
            Title
          </Label>
          <Input
            id="list-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="List title"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="curator-name" className="font-semibold text-muted-foreground">
            Curator name
          </Label>
          <Input
            id="curator-name"
            value={curatorName}
            onChange={(e) => setCuratorName(e.target.value)}
            placeholder="Curator name"
          />
        </div>
      </div>

      {/* Cover image — D-14/D-15 */}
      <div className="space-y-2">
        <p className="text-base font-semibold">Cover Image</p>
        <CmsCoverUploader
          listId={list.id}
          initialUrl={coverUrl || null}
          onUpload={async (url) => {
            setCoverUrl(url)
            // Persist the cover URL immediately after upload.
            await updateCuratedList({ id: list.id, coverUrl: url })
          }}
          onRemove={() => setCoverUrl('')}
        />
      </div>

      {/* Intro copy — D-13 */}
      <div className="space-y-2">
        <p className="text-base font-semibold">Intro Copy</p>
        <MarkdownEditor
          value={introMarkdown}
          onChange={setIntroMarkdown}
          placeholder="Write an introduction for this list…"
        />
      </div>

      {/* Watch items — D-11 */}
      <div className="space-y-4">
        <p className="text-base font-semibold">List Items</p>
        <WatchPicker
          addedCatalogIds={addedCatalogIds}
          onSelect={handleAddWatch}
          placeholder="Search watches to add…"
        />

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No watches added. Search above to add watches to this list.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => {
              const isFirst = idx === 0
              const isLast = idx === items.length - 1
              const reordering = reorderingItemId === item.id
              const removing = removingItemId === item.id

              return (
                <Card key={item.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      {/* D-12: reorder buttons */}
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Move up"
                          disabled={isFirst || reordering}
                          onClick={() => handleMoveItem(item.id, 'up')}
                        >
                          {reordering ? (
                            <Loader2 className="animate-spin" aria-hidden="true" />
                          ) : (
                            <ChevronUp aria-hidden="true" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Move down"
                          disabled={isLast || reordering}
                          onClick={() => handleMoveItem(item.id, 'down')}
                        >
                          {reordering ? (
                            <Loader2 className="animate-spin" aria-hidden="true" />
                          ) : (
                            <ChevronDown aria-hidden="true" />
                          )}
                        </Button>
                      </div>

                      {/* Watch thumbnail (CSS chain assertion: size-10 + object-cover) */}
                      <div className="size-10 rounded-sm overflow-hidden bg-muted shrink-0">
                        {/* Thumbnail placeholder — catalog photo not available from list-item alone */}
                        <div className="size-10 bg-muted flex items-center justify-center text-xs text-muted-foreground">
                          {idx + 1}
                        </div>
                      </div>

                      {/* Commentary + remove */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <p className="text-xs text-muted-foreground truncate">
                          Watch ID: {item.catalogId.slice(0, 8)}…
                        </p>
                        <Textarea
                          defaultValue={item.commentary ?? ''}
                          placeholder="Add commentary for this watch…"
                          className="min-h-[60px]"
                          onBlur={(e) => handleUpdateCommentary(item.id, e.target.value)}
                        />
                      </div>

                      {/* Remove button */}
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Remove watch"
                        disabled={removing}
                        onClick={() => handleRemoveWatch(item.id)}
                        className="shrink-0 text-destructive"
                      >
                        {removing ? (
                          <Loader2 className="animate-spin" aria-hidden="true" />
                        ) : (
                          <X aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Save / Publish controls */}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleSaveDraft}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            'Save Draft'
          )}
        </Button>

        {list.status === 'draft' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                {/* span wrapper needed: disabled buttons don't fire mouse events */}
                <span>
                  <Button
                    type="button"
                    variant="default"
                    onClick={handlePublish}
                    disabled={!canPublish || publishing}
                  >
                    {publishing ? (
                      <>
                        <Loader2 className="animate-spin" aria-hidden="true" />
                        Publishing…
                      </>
                    ) : (
                      'Publish List'
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {!canPublish && (
                <TooltipContent>Add at least one watch to publish.</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )}

        {list.status === 'published' && (
          <Button
            type="button"
            variant="secondary"
            onClick={handleUnpublish}
            disabled={publishing}
          >
            {publishing ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Unpublishing…
              </>
            ) : (
              'Unpublish List'
            )}
          </Button>
        )}
      </div>

      {/* Delete List — separated by border-t divider (UI-SPEC §Component Inventory) */}
      <div className="border-t border-border mt-8 pt-8">
        <Button
          type="button"
          variant="destructive"
          onClick={() => setShowDeleteDialog(true)}
        >
          Delete List
        </Button>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete this list?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Deleting…
                </>
              ) : (
                'Delete List'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hero-pin dialog — CMS-08 */}
      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Pin as Hero</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pin-expiry" className="font-semibold text-muted-foreground">
              Expiry (optional)
            </Label>
            <input
              id="pin-expiry"
              type="date"
              value={pinExpiry}
              onChange={(e) => setPinExpiry(e.target.value)}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />} onClick={() => setShowPinDialog(false)}>
              Cancel
            </DialogClose>
            <Button variant="default" onClick={handlePin} disabled={pinning}>
              {pinning ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Pinning…
                </>
              ) : (
                'Pin'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
