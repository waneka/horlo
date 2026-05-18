'use client'

// Curated lists index — interactive client shell.
//
// "New List" button: calls createCuratedList with defaults and routes to editor.
// D-12: up/down reorder via arrow buttons (no drag-and-drop).
// Empty state per UI-SPEC §Copywriting Contract.
// D-06: FK-RESTRICT error surfaces a destructive toast.

import { useState } from 'react'
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
} from '@/components/ui/dialog'
import { DialogClose } from '@/components/ui/dialog'
import {
  createCuratedList,
  deleteCuratedList,
  moveListUp,
  moveListDown,
} from '@/app/actions/cms/curatedLists'
import { toast } from 'sonner'

type CuratedList = {
  id: string
  title: string
  curatorName: string
  status: 'draft' | 'published'
  sortOrder: number
  coverUrl: string | null | undefined
  introMarkdown: string | null | undefined
  createdAt: Date
  updatedAt: Date
}

interface ListIndexClientProps {
  lists: CuratedList[]
}

export function ListIndexClient({ lists: initialLists }: ListIndexClientProps) {
  const router = useRouter()
  const [lists, setLists] = useState<CuratedList[]>(initialLists)
  const [creating, setCreating] = useState(false)
  const [reorderingId, setReorderingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CuratedList | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Refresh lists from server — triggers re-render via router invalidation.
  function refresh() {
    router.refresh()
  }

  async function handleNewList() {
    setCreating(true)
    // WR-04: await the Server Action directly. The previous Promise +
    // startTransition wrapper and `result!` non-null assertions were unsafe —
    // the action is already awaitable and this is a navigate-after pattern.
    // Pass both required fields — curatorName defaults to 'Curator' and the
    // owner can edit it in the editor. createListSchema requires min(1) on
    // both fields, so we provide a non-empty default.
    const result = await createCuratedList({ title: 'Untitled List', curatorName: 'Curator' })
    setCreating(false)
    if (result.success) {
      router.push('/admin/lists/' + result.data.id)
    } else {
      toast.error("Couldn't create list. Try again.")
    }
  }

  async function handleMove(listId: string, direction: 'up' | 'down') {
    setReorderingId(listId)
    const action = direction === 'up' ? moveListUp : moveListDown
    const result = await action(listId)
    setReorderingId(null)
    if (!result.success) {
      toast.error("Couldn't reorder list. Try again.")
    } else {
      refresh()
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteCuratedList(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    if (!result.success) {
      // WR-01: deleting a curated_lists row cascades to its items — it never
      // hits an FK RESTRICT today. If the action ever forwards a discriminable
      // FK error (future RESTRICT reference), surface its message verbatim;
      // otherwise show the generic failure.
      const isFkError =
        typeof result.error === 'string' && result.error.includes('foreign key')
      if (isFkError && result.error) {
        toast.error(result.error)
      } else {
        toast.error("Couldn't delete list. Try again.")
      }
    } else {
      toast.success('List deleted.')
      setLists((prev) => prev.filter((l) => l.id !== deleteTarget.id))
      refresh()
    }
  }

  return (
    <div className="space-y-4">
      {/* Primary CTA — "New List" (UI-SPEC §Copywriting Contract) */}
      <Button
        variant="default"
        onClick={handleNewList}
        disabled={creating}
        className="w-full sm:w-auto"
      >
        {creating ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            Creating…
          </>
        ) : (
          'New List'
        )}
      </Button>

      {lists.length === 0 ? (
        /* Empty state (UI-SPEC §Copywriting Contract) */
        <div className="py-12 text-center space-y-2">
          <p className="font-semibold text-muted-foreground">No lists yet</p>
          <p className="text-sm text-muted-foreground">
            Create your first curated list to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lists.map((list, idx) => {
            const isFirst = idx === 0
            const isLast = idx === lists.length - 1
            const reordering = reorderingId === list.id

            return (
              <Card key={list.id}>
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
                        onClick={() => handleMove(list.id, 'up')}
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
                        onClick={() => handleMove(list.id, 'down')}
                      >
                        {reordering ? (
                          <Loader2 className="animate-spin" aria-hidden="true" />
                        ) : (
                          <ChevronDown aria-hidden="true" />
                        )}
                      </Button>
                    </div>

                    {/* List info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold truncate">{list.title}</span>
                        <Badge variant={list.status === 'published' ? 'default' : 'secondary'}>
                          {list.status === 'published' ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{list.curatorName}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        render={<Link href={`/admin/lists/${list.id}`} />}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteTarget(list)}
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

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete this list?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />} onClick={() => setDeleteTarget(null)}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
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
    </div>
  )
}
