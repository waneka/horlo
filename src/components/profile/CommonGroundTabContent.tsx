import { ProfileWatchCard } from '@/components/profile/ProfileWatchCard'
import { TasteTagPill } from '@/components/profile/TasteTagPill'
import type {
  SharedDistributionRow,
  TasteOverlapResult,
} from '@/lib/tasteOverlap'

interface CommonGroundTabContentProps {
  overlap: TasteOverlapResult
  ownerDisplayLabel: string
}

/**
 * 6th-tab detail view — renders top-to-bottom:
 *   1. Overlap explainer card (overlap label heading + per-variant body)
 *   2. Shared watches grid    (omitted when sharedWatches is empty)
 *   3. Shared taste tags row  (omitted when sharedTasteTags is empty)
 *   4. Collection composition (dual style+role bars; omitted when both empty)
 *
 * Existence of this component is gated by the layout's three-way gate
 * (viewer && !isOwner && collectionPublic) AND `overlap.hasAny === true`.
 * See src/app/u/[username]/common-ground-gate.ts.
 */
export function CommonGroundTabContent({
  overlap,
  ownerDisplayLabel,
}: CommonGroundTabContentProps) {
  const showWatches = overlap.sharedWatches.length > 0
  const showTags = overlap.sharedTasteTags.length > 0
  const showComposition =
    overlap.sharedStyleRows.length > 0 || overlap.sharedRoleRows.length > 0

  return (
    <div className="space-y-8">
      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-xl font-semibold">{overlap.overlapLabel}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {buildExplainerBody(overlap, ownerDisplayLabel)}
        </p>
      </section>

      {showWatches && (
        <section>
          <h3 className="text-base font-semibold">
            Shared watches ({overlap.sharedWatches.length})
          </h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {overlap.sharedWatches.map((sw) => (
              <ProfileWatchCard
                key={sw.ownerWatch.id}
                watch={sw.ownerWatch}
                lastWornDate={null}
              />
            ))}
          </div>
        </section>
      )}

      {showTags && (
        <section>
          <h3 className="text-base font-semibold">Shared taste tags</h3>
          <ul className="mt-4 flex flex-wrap gap-2">
            {overlap.sharedTasteTags.map((t) => (
              <li key={t}>
                <TasteTagPill>{t}</TasteTagPill>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showComposition && (
        <section>
          <h3 className="text-base font-semibold">Collection composition</h3>
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="mr-2 inline-block size-3 rounded bg-muted align-middle" />
            <span>You</span>
            <span className="mx-2">·</span>
            <span className="mr-2 inline-block size-3 rounded bg-accent align-middle" />
            <span>{ownerDisplayLabel}</span>
          </p>
          <div className="mt-4 space-y-6">
            {overlap.sharedStyleRows.length > 0 && (
              <DualBarGroup
                title="Styles"
                rows={overlap.sharedStyleRows}
              />
            )}
            {overlap.sharedRoleRows.length > 0 && (
              <DualBarGroup title="Roles" rows={overlap.sharedRoleRows} />
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function DualBarGroup({
  title,
  rows,
}: {
  title: string
  rows: SharedDistributionRow[]
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="mt-2 space-y-3">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center gap-3 text-sm"
          >
            <span className="w-24 shrink-0 truncate">{row.label}</span>
            <div className="flex flex-1 flex-col gap-1">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full border border-accent bg-muted"
                  style={{ width: `${row.viewerPct}%` }}
                />
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${row.ownerPct}%` }}
                />
              </div>
            </div>
            <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
              {Math.round(row.viewerPct)}% / {Math.round(row.ownerPct)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function buildExplainerBody(
  overlap: TasteOverlapResult,
  ownerDisplayLabel: string,
): string {
  if (overlap.overlapLabel === 'Different taste') {
    return 'Your collections dont overlap much — different taste, different styles.'
  }
  if (overlap.overlapLabel === 'Some overlap') {
    const watchN = overlap.sharedWatches.length
    const tagN = overlap.sharedTasteTags.length
    return `You share ${watchN} watch${watchN === 1 ? '' : 'es'} and ${tagN} taste tag${tagN === 1 ? '' : 's'} with ${ownerDisplayLabel}.`
  }
  // Strong overlap
  const topSharedStyle = overlap.sharedStyleRows.find(
    (r) => r.viewerPct > 0 && r.ownerPct > 0,
  )
  const styleFrag = topSharedStyle
    ? `lean ${topSharedStyle.label.toLowerCase()} together`
    : 'lean similarly'
  const watchN = overlap.sharedWatches.length
  return `You and ${ownerDisplayLabel} ${styleFrag} and share ${watchN} watch${watchN === 1 ? '' : 'es'} in your collections.`
}
