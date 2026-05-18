'use client'

// Full collection-path editor.
//
// D-16: path-type chip row with exactly four fixed-vocabulary strings.
// D-11: WatchPicker for seed (node 0) + up to 3 follow-ons.
// CMS-07: max 3 follow-on slots.
// D-12: no drag-and-drop; seed has no remove button.
// Publish guard: seed watch + path type both required.
// D-06: FK-RESTRICT delete surfaces a destructive toast.
//
// Path structure:
//   - seedCatalogId: stored on the path row itself (node 0 / seed)
//   - follow-on nodes: collection_path_nodes rows (sortOrder 0..2)

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { WatchPicker } from '@/components/admin/WatchPicker'
import {
  updateCollectionPath,
  deleteCollectionPath,
  setPathNode,
  removePathNode,
  publishCollectionPath,
  unpublishCollectionPath,
} from '@/app/actions/cms/collectionPaths'
import { toast } from 'sonner'

// D-16: exactly four fixed-vocabulary path-type strings.
const PATH_TYPES = ['Going Deeper', 'Branching Out', 'Trading Up', 'Filling a Gap'] as const
type PathType = (typeof PATH_TYPES)[number]

type PathNode = {
  id: string
  pathId: string
  catalogId: string
  rationale: string | null
  sortOrder: number
  createdAt: Date
}

type CollectionPath = {
  id: string
  seedCatalogId: string
  status: 'draft' | 'published'
  pathType: string
  rationale: string | null
  sortOrder: number
  source: 'manual' | 'computed'
  createdAt: Date
  updatedAt: Date
  nodes: PathNode[]
}

interface PathEditorClientProps {
  path: CollectionPath
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

export function PathEditorClient({ path: initialPath }: PathEditorClientProps) {
  const router = useRouter()
  const [path, setPath] = useState<CollectionPath>(initialPath)

  // Editable state
  const [pathType, setPathType] = useState<PathType | null>(
    PATH_TYPES.includes(initialPath.pathType as PathType)
      ? (initialPath.pathType as PathType)
      : null,
  )
  const [rationale, setRationale] = useState(initialPath.rationale ?? '')

  // UI state
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [removingNodeId, setRemovingNodeId] = useState<string | null>(null)
  const [settingNodeSlot, setSettingNodeSlot] = useState<number | null>(null)

  const nodes = path.nodes // follow-on nodes (sortOrder 0..2, max 3)

  function refresh() {
    router.refresh()
  }

  // Build a map of slot→node for follow-ons (slots 0..2).
  const nodeBySlot = new Map<number, PathNode>()
  for (const node of nodes) {
    nodeBySlot.set(node.sortOrder, node)
  }

  // All catalog IDs already in use (seed + follow-ons).
  const usedCatalogIds = [path.seedCatalogId, ...nodes.map((n) => n.catalogId)]

  // ---- Save Draft ----
  async function handleSaveDraft() {
    if (!pathType) {
      toast.error('Select a path type first.')
      return
    }
    setSaving(true)
    const result = await updateCollectionPath({
      pathId: path.id,
      pathType,
      rationale: rationale || null,
    })
    setSaving(false)
    if (!result.success) {
      toast.error("Couldn't save changes. Try again.")
    } else {
      toast.success('Draft saved.')
      setPath((prev) => ({ ...prev, pathType: pathType, rationale: rationale || null }))
      refresh()
    }
  }

  // ---- Publish / Unpublish ----
  async function handlePublish() {
    setPublishing(true)
    const result = await publishCollectionPath(path.id)
    setPublishing(false)
    if (!result.success) {
      toast.error(result.error ?? "Couldn't publish path. Try again.")
    } else {
      toast.success('Path published.')
      setPath((prev) => ({ ...prev, status: 'published' }))
      refresh()
    }
  }

  async function handleUnpublish() {
    setPublishing(true)
    const result = await unpublishCollectionPath(path.id)
    setPublishing(false)
    if (!result.success) {
      toast.error("Couldn't unpublish path. Try again.")
    } else {
      toast.success('Path unpublished.')
      setPath((prev) => ({ ...prev, status: 'draft' }))
      refresh()
    }
  }

  // ---- Delete ----
  async function handleDelete() {
    setDeleting(true)
    const result = await deleteCollectionPath(path.id)
    setDeleting(false)
    setShowDeleteDialog(false)
    if (!result.success) {
      toast.error(isFkRestrictError(result.error) ? FK_RESTRICT_ERROR : "Couldn't delete path. Try again.")
    } else {
      router.push('/admin/paths')
    }
  }

  // ---- Follow-on nodes ----
  async function handleSetNode(slot: number, catalogId: string) {
    setSettingNodeSlot(slot)
    const result = await setPathNode({ pathId: path.id, slot, catalogId })
    setSettingNodeSlot(null)
    if (!result.success) {
      toast.error("Couldn't set path node. Try again.")
    } else {
      refresh()
    }
  }

  async function handleRemoveNode(nodeId: string) {
    setRemovingNodeId(nodeId)
    const result = await removePathNode(nodeId)
    setRemovingNodeId(null)
    if (!result.success) {
      toast.error(isFkRestrictError(result.error) ? FK_RESTRICT_ERROR : "Couldn't remove node. Try again.")
    } else {
      refresh()
    }
  }

  // Publish gate: requires seed watch + exactly one path type selected.
  const canPublish = !!path.seedCatalogId && !!pathType

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">
        {pathType ?? 'Collection Path'}
      </h1>

      {/* Seed watch slot — node 0, no remove button (D-11) */}
      <div className="space-y-2">
        <p className="text-base font-semibold">Seed Watch</p>
        <Card>
          <CardContent className="pt-4">
            {path.seedCatalogId ? (
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-sm overflow-hidden bg-muted shrink-0">
                  <div className="size-10 flex items-center justify-center text-xs text-muted-foreground">
                    S
                  </div>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  Seed: {path.seedCatalogId.slice(0, 8)}…
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No seed watch set.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Follow-on watch pickers — slots 0..2 (max 3, CMS-07) */}
      <div className="space-y-4">
        <p className="text-base font-semibold">Follow-on Watches</p>

        {[0, 1, 2].map((slot) => {
          const node = nodeBySlot.get(slot)
          const slotLabel = `Follow-on ${slot + 1}`
          const isSettingThisSlot = settingNodeSlot === slot
          const isRemovingThisNode = node ? removingNodeId === node.id : false

          return (
            <div key={slot} className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">{slotLabel}</p>
              {node ? (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-sm overflow-hidden bg-muted shrink-0">
                        <div className="size-10 flex items-center justify-center text-xs text-muted-foreground">
                          {slot + 1}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <p className="text-xs text-muted-foreground truncate">
                          Watch: {node.catalogId.slice(0, 8)}…
                        </p>
                        <Textarea
                          defaultValue={node.rationale ?? ''}
                          placeholder="Add rationale for this follow-on…"
                          className="min-h-[60px]"
                          onBlur={async (e) => {
                            // Update rationale by re-setting the node with the same catalogId.
                            await setPathNode({
                              pathId: path.id,
                              slot,
                              catalogId: node.catalogId,
                              rationale: e.target.value || null,
                            })
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Remove ${slotLabel}`}
                        disabled={isRemovingThisNode}
                        onClick={() => handleRemoveNode(node.id)}
                        className="shrink-0 text-destructive"
                      >
                        {isRemovingThisNode ? (
                          <Loader2 className="animate-spin" aria-hidden="true" />
                        ) : (
                          <X aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div>
                  {isSettingThisSlot ? (
                    <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                      <Loader2 className="animate-spin size-4" aria-hidden="true" />
                      Adding watch…
                    </div>
                  ) : (
                    <WatchPicker
                      addedCatalogIds={usedCatalogIds}
                      onSelect={(catalogId) => handleSetNode(slot, catalogId)}
                      placeholder={`Search for ${slotLabel}…`}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}

        {nodes.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            No follow-on watches added. Search above to build the path.
          </p>
        )}
      </div>

      {/* D-16: Path-type chip row — exactly four fixed-vocabulary strings */}
      <div className="space-y-2">
        <p className="text-base font-semibold">Path Type</p>
        <div className="flex flex-wrap gap-2">
          {PATH_TYPES.map((type) => (
            <Button
              key={type}
              type="button"
              size="sm"
              variant={pathType === type ? 'secondary' : 'outline'}
              onClick={() => setPathType(type)}
            >
              {type}
            </Button>
          ))}
        </div>
      </div>

      {/* Editorial rationale */}
      <div className="space-y-2">
        <p className="text-base font-semibold">Editorial Rationale</p>
        <Textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Explain the through-line of this path…"
          className="min-h-16 field-sizing-content"
        />
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

        {path.status === 'draft' && (
          <Button
            type="button"
            variant="default"
            onClick={handlePublish}
            disabled={!canPublish || publishing}
            title={!canPublish ? 'Add at least one watch to publish.' : undefined}
          >
            {publishing ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Publishing…
              </>
            ) : (
              'Publish Path'
            )}
          </Button>
        )}

        {path.status === 'published' && (
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
              'Unpublish Path'
            )}
          </Button>
        )}
      </div>

      {/* Delete Path — separated by border-t divider (UI-SPEC §Component Inventory) */}
      <div className="border-t border-border mt-8 pt-8">
        <Button
          type="button"
          variant="destructive"
          onClick={() => setShowDeleteDialog(true)}
        >
          Delete Path
        </Button>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete this path?</DialogTitle>
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
                'Delete Path'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
