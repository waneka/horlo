import { describe, it } from 'vitest'

/**
 * Phase 20 FIT-04 D-05 — Accordion one-at-a-time + ESC + cache.
 *
 * Filled by Plan 05 Task: "Implement WatchSearchRowsAccordion + tests".
 */
describe('FIT-04 D-05 WatchSearchRowsAccordion (Plan 05)', () => {
  it.todo('clicking a row trigger expands its panel and renders <CollectionFitCard>')
  it.todo('opening a second row collapses the first (one-at-a-time, multiple={false})')
  it.todo('ESC key collapses the open row')
  it.todo('Tab key moves focus between row triggers without entering panel content')
  it.todo('chevron rotates 180deg when row is open (data-[state=open]:rotate-180)')
  it.todo('button label toggles "Evaluate" → "Hide" via data-state attribute')
  it.todo('first expand fires getVerdictForCatalogWatch Server Action')
  it.todo('re-expand of same row uses cache (no second Server Action call)')
  it.todo('shows <VerdictSkeleton /> while Server Action is pending')
  it.todo('Sonner toast fires on Server Action error and panel collapses')
})
