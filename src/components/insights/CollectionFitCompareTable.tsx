import { Badge } from '@/components/ui/badge'
import type { CatalogTasteAttributes } from '@/lib/types'
import { computeDeltaPhrase } from '@/lib/verdict/fit-delta'

// ─── Props ───────────────────────────────────────────────────────────────────

export interface CollectionFitCompareTableProps {
  candidate: CatalogTasteAttributes
  owned: CatalogTasteAttributes
  ownedBrand: string
  ownedModel: string
}

// ─── File-private helpers ────────────────────────────────────────────────────

/**
 * Scalar cell: progress bar + percentage. Null → em-dash.
 * A11y: role="meter" with aria-valuenow/min/max/label on the bar wrapper.
 */
function ScalarCell({ value, label }: { value: number | null; label: string }) {
  if (value === null) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const pct = Math.round(value * 100)
  return (
    <span
      className="flex items-center gap-1.5"
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label} ${pct}%`}
    >
      <span className="h-1.5 rounded-full bg-border flex-1 overflow-hidden">
        <span
          className="h-full rounded-full bg-foreground/60 block"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-xs text-muted-foreground w-8 text-right shrink-0">{pct}%</span>
    </span>
  )
}

/**
 * Display transform for closed-vocab enum values.
 * Replaces underscores and hyphens with spaces, then title-cases each word.
 * null → em-dash.
 */
function displayEnum(val: string | null | undefined): string {
  if (val == null) return '—'
  return val
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Design motifs chip cluster. Empty array → em-dash.
 */
function MotifsCell({ motifs }: { motifs: string[] }) {
  if (motifs.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <span className="flex flex-wrap gap-1">
      {motifs.map((m) => (
        <Badge key={m} variant="outline" className="text-xs px-1.5 py-0">
          {m.charAt(0).toUpperCase() + m.slice(1)}
        </Badge>
      ))}
    </span>
  )
}

// Shared cell class names
const tdClass = 'bg-background px-2 py-2 text-foreground text-xs border-l border-l-border border-b border-border'
const tdLastClass = 'bg-background px-2 py-2 text-foreground text-xs border-l border-l-border'
const thRowClass = 'px-2 py-2 text-left text-xs text-muted-foreground font-normal border-b border-border'
const thRowLastClass = 'px-2 py-2 text-left text-xs text-muted-foreground font-normal'

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * FIT-05 pairwise taste drill-down table.
 *
 * Pure renderer — no engine imports. Allowed imports:
 *   @/components/ui/badge, @/lib/types, @/lib/verdict/fit-delta
 *
 * Sits inside CollectionFitCard below the mostSimilar list.
 * D-15 confidence gate is enforced by the caller (CollectionFitCard) — this
 * component always renders when mounted. Both `candidate` and `owned` are
 * guaranteed to have confidence >= 0.5 by the time they arrive here.
 *
 * Layout: 3-column semantic table (dimension label | candidate | owned) for
 * screen-reader accessibility (UI-SPEC §Accessibility — "auto-resolved: use
 * <table> for screen-reader compatibility; dimension labels as row headers").
 * The label column is visually compressed with text-xs text-muted-foreground.
 * D-13 "max 2 items on mobile" refers to the VALUE columns — the label column
 * is a compact row header, not a value column.
 */
export function CollectionFitCompareTable({
  candidate,
  owned,
  ownedBrand,
  ownedModel,
}: CollectionFitCompareTableProps) {
  const deltaPhrase = computeDeltaPhrase(candidate, owned)

  return (
    <div className="flex flex-col gap-3">
      {/* Section title — D-12 */}
      <h4 className="text-base font-semibold text-foreground">
        Compare with the {ownedBrand} {ownedModel} you own
      </h4>

      {/* 3-column semantic table: label | candidate | owned.
          Uses <table> for screen-reader compatibility per UI-SPEC §Accessibility.
          Column headers use scope="col"; row label cells use scope="row". */}
      <table className="w-full text-sm border-separate border-spacing-0 rounded-md overflow-hidden border border-border">
        <thead>
          <tr>
            <th scope="col" className="sr-only">
              Dimension
            </th>
            <th
              scope="col"
              className="bg-muted px-2 py-2 font-semibold text-foreground text-xs uppercase tracking-wide text-left border-b border-border"
            >
              This watch
            </th>
            <th
              scope="col"
              className="bg-muted px-2 py-2 font-semibold text-foreground text-xs uppercase tracking-wide text-left border-b border-border border-l border-l-border"
            >
              Your {ownedBrand} {ownedModel}
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Row 1: Formality (scalar 0–1) */}
          <tr>
            <th scope="row" className={thRowClass}>Formality</th>
            <td className={tdClass}><ScalarCell value={candidate.formality} label="Formality" /></td>
            <td className={tdClass}><ScalarCell value={owned.formality} label="Formality" /></td>
          </tr>
          {/* Row 2: Sportiness (scalar 0–1) */}
          <tr>
            <th scope="row" className={thRowClass}>Sportiness</th>
            <td className={tdClass}><ScalarCell value={candidate.sportiness} label="Sportiness" /></td>
            <td className={tdClass}><ScalarCell value={owned.sportiness} label="Sportiness" /></td>
          </tr>
          {/* Row 3: Heritage (scalar 0–1) */}
          <tr>
            <th scope="row" className={thRowClass}>Heritage</th>
            <td className={tdClass}><ScalarCell value={candidate.heritageScore} label="Heritage" /></td>
            <td className={tdClass}><ScalarCell value={owned.heritageScore} label="Heritage" /></td>
          </tr>
          {/* Row 4: Era (closed-vocab enum)
              Phase 49.1 D-SCOPE-01b — Archetype row deleted; Era now sits between
              Heritage and Design Motifs. Uses thRowClass/tdClass (not last). */}
          <tr>
            <th scope="row" className={thRowClass}>Era</th>
            <td className={tdClass}>
              <span className="text-xs text-foreground">{displayEnum(candidate.eraSignal)}</span>
            </td>
            <td className={tdClass}>
              <span className="text-xs text-foreground">{displayEnum(owned.eraSignal)}</span>
            </td>
          </tr>
          {/* Row 5: Design Motifs (chip cluster) — last row, no bottom border.
              UI-SPEC §B: thRowLastClass + tdLastClass; outer table border + rounded-md
              corner clip supply the visual bottom edge. */}
          <tr>
            <th scope="row" className={thRowLastClass}>Design Motifs</th>
            <td className={tdLastClass}><MotifsCell motifs={candidate.designMotifs} /></td>
            <td className={tdLastClass}><MotifsCell motifs={owned.designMotifs} /></td>
          </tr>
        </tbody>
      </table>

      {/* Delta phrase — D-16 single highest-delta dimension as plain-language phrase */}
      <p className="text-sm text-muted-foreground">{deltaPhrase}</p>
    </div>
  )
}
