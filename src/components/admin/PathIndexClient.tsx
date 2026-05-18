'use client'

// Collection paths index — interactive client shell.
//
// "New Path" button: createCollectionPath requires seedCatalogId + pathType (schema-enforced).
// We collect the seed watch via a WatchPicker dialog before calling the action.
// D-12: up/down reorder via arrow buttons.
// Empty state per UI-SPEC §Copywriting Contract.
// D-06: FK-RESTRICT error surfaces a destructive toast.
//
// NOTE: createCollectionPath schema requires both seedCatalogId (UUID) and pathType.
// The plan originally described omitting seedCatalogId, but the action validates both
// as required fields. We therefore collect them in a "New Path" dialog before creating
// the draft — matching the action's schema contract without changing it.

import { startTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  createCollectionPath,
  deleteCollectionPath,
  movePathUp,
  movePathDown,
} from '@/app/actions/cms/collectionPaths'
import { toast } from 'sonner'

const PATH_TYPES = ['Going Deeper', 'Branching Out', 'Trading Up', 'Filling a Gap'] as const
type PathType = (typeof PATH_TYPES)[number]

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
}

interface PathIndexClientProps {
  paths: CollectionPath[]
}

export function PathIndexClient({ paths: initialPaths }: PathIndexClientProps) {
  const router = useRouter()
  const [paths, setPaths] = useState<CollectionPath[]>(initialPaths)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newSeedId, setNewSeedId] = useState<string | null>(null)
  const [newPathType, setNewPathType] = useState<PathType | null>(null)
  const [creating, setCreating] = useState(false)
  const [reorderingId, setReorderingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CollectionPath | null>(null)
  const [deleting, setDeleting] = useState(false)

  function refresh() {
    router.refresh()
  }

  // Reset dialog state when opening.
  function openNewDialog() {
    setNewSeedId(null)
    setNewPathType(null)
    setShowNewDialog(true)
  }

  async function handleCreate() {
    if (!newSeedId || !newPathType) {
      toast.error('Select a seed watch and a path type first.')
      return
    }
    setCreating(true)
    let result: Awaited<ReturnType<typeof createCollectionPath>>
    await new Promise<void>((resolve) => {
      startTransition(async () => {
        result = await createCollectionPath({
          seedCatalogId: newSeedId,
          pathType: newPathType,
        })
        resolve()
      })
    })
    setCreating(false)
    setShowNewDialog(false)
    if (result!.success) {
      router.push('/admin/paths/' + result!.data.id)
    } else {
      toast.error("Couldn't create path. Try again.")
    }
  }

  async function handleMove(pathId: string, direction: 'up' | 'down') {
    setReorderingId(pathId)
    const action = direction === 'up' ? movePathUp : movePathDown
    const result = await action(pathId)
    setReorderingId(null)
    if (!result.success) {
      toast.error("Couldn't reorder path. Try again.")
    } else {
      refresh()
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteCollectionPath(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    if (!result.success) {
      // WR-01: deleting a collection_paths row cascades to its nodes — it never
      // hits an FK RESTRICT today. If the action ever forwards a discriminable
      // FK error (future RESTRICT reference), surface its message verbatim;
      // otherwise show the generic failure.
      const isFkError =
        typeof result.error === 'string' && result.error.includes('foreign key')
      if (isFkError && result.error) {
        toast.error(result.error)
      } else {
        toast.error("Couldn't delete path. Try again.")
      }
    } else {
      toast.success('Path deleted.')
      setPaths((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      refresh()
    }
  }

  const canCreate = !!newSeedId && !!newPathType

  return (
    <div className="space-y-4">
      {/* Primary CTA — "New Path" (UI-SPEC §Copywriting Contract) */}
      <Button variant="default" onClick={openNewDialog} className="w-full sm:w-auto">
        New Path
      </Button>

      {paths.length === 0 ? (
        /* Empty state (UI-SPEC §Copywriting Contract) */
        <div className="py-12 text-center space-y-2">
          <p className="font-semibold text-muted-foreground">No collection paths yet</p>
          <p className="text-sm text-muted-foreground">
            Create your first collection path.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {paths.map((path, idx) => {
            const isFirst = idx === 0
            const isLast = idx === paths.length - 1
            const reordering = reorderingId === path.id

            return (
              <Card key={path.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    {/* Reorder buttons — D-12 */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Move up"
                        disabled={isFirst || reordering}
                        onClick={() => handleMove(path.id, 'up')}
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
                        onClick={() => handleMove(path.id, 'down')}
                      >
                        {reordering ? (
                          <Loader2 className="animate-spin" aria-hidden="true" />
                        ) : (
                          <ChevronDown aria-hidden="true" />
                        )}
                      </Button>
                    </div>

                    {/* Path info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant="secondary">{path.pathType}</Badge>
                        <Badge variant={path.status === 'published' ? 'default' : 'secondary'}>
                          {path.status === 'published' ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        Seed: {path.seedCatalogId.slice(0, 8)}…
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        render={<Link href={`/admin/paths/${path.id}`} />}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteTarget(path)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* New Path dialog — collect seed watch + path type before creating */}
      <Dialog open={showNewDialog} onOpenChange={(open) => !open && setShowNewDialog(false)}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>New Collection Path</DialogTitle>
            <DialogDescription>
              Select a seed watch and path type to get started.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">Seed Watch</p>
              {newSeedId ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted text-sm">
                  <span className="text-muted-foreground truncate">
                    Watch selected: {newSeedId.slice(0, 8)}…
                  </span>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => setNewSeedId(null)}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <WatchPicker
                  onSelect={(id) => setNewSeedId(id)}
                  placeholder="Search for a seed watch…"
                />
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">Path Type</p>
              <div className="flex flex-wrap gap-2">
                {PATH_TYPES.map((type) => (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    variant={newPathType === type ? 'secondary' : 'outline'}
                    onClick={() => setNewPathType(type)}
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="default"
              onClick={handleCreate}
              disabled={!canCreate || creating}
            >
              {creating ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Creating…
                </>
              ) : (
                'Create Path'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete this path?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />} onClick={() => setDeleteTarget(null)}>
              Cancel
            </DialogClose>
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
