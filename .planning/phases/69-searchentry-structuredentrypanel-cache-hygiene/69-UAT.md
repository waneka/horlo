---
status: complete
phase: 69-searchentry-structuredentrypanel-cache-hygiene
source: [69-VERIFICATION.md human_verification block]
deploy: 418f0515 (origin/main tip — pushed 2026-05-29)
started: 2026-05-29T23:20:00Z
updated: 2026-05-29T23:35:00Z
---

## Current Test

[testing complete — 2 passed / 2 issues / 0 pending]

## Tests

### 1. Search debounce + cover photo + viewer-state badges
expected: Typing 'speedmaster' into /watch/new search input shows results after ~250ms pause (not on every keystroke); results display brand, model, reference, and cover photo; 'In collection' / 'On wishlist' badges (NOT 'Owned' / 'Wishlist') appear for watches you own or have wishlisted.
result: pass

### 2. Combobox keyboard navigation
expected: In search results, Up/Down arrow keys move focus visually through result rows; Enter fires onPick (advances flow to Phase 70's confirm/redirect); no keyboard trap.
result: issue
reported: "down/up arrows don't traverse the options at all - nothing happens. hitting enter just closes the options"
severity: major
notes: SRCH-02 (combobox-keyboard-broken). WAI-ARIA combobox keyboard contract fully broken. @base-ui/react/combobox 1.3.0 should auto-handle this. Either result rows aren't registered as options (missing/wrong role="option"), the activeIndex state isn't being managed, the Combobox.Item wrapper isn't being used (raw divs instead), or the input's keyboard events aren't reaching the listbox. Enter closing the popup (instead of picking) suggests the events ARE reaching the input but the listbox isn't tracking an active selection to commit. Accessibility-blocker; major UX miss for power users.

### 3. No-match state + inline StructuredEntryPanel
expected: Typing 3+ characters that match nothing (e.g., 'zzz'), the StructuredEntryPanel mounts inline below the search input with pre-seeded fields; 'Have a URL for this watch?' ghost link is visible; typing back to valid results collapses the panel.
result: pass

### 4. 'Not finding it? Add manually' footer row
expected: On /watch/new with results present, a 'Not finding it? Add manually' footer row appears below results; clicking it expands the same StructuredEntryPanel inline with the parsed brand/model/reference pre-seeded.
result: issue
reported: "the footer row is visible as expected - clicking it doesn't do anything"
severity: major
notes: SRCH-03 (footer-row-click-noop). The SRCH-24 footer renders but click handler isn't wired. Either onClick is missing on the footer row, or the click is being swallowed by Combobox.List (popup eats clicks that aren't on Combobox.Item). User has workarounds (type zero-match query, or click separate 'Skip search' link) but the in-flow shortcut is dead.

## Summary

total: 4
passed: 2
issues: 2
pending: 0
skipped: 0
blocked: 0
defects_total: 2
defects:
  - SRCH-02 (major, test 2) — combobox keyboard navigation broken (Up/Down/Enter)
  - SRCH-03 (major, test 4) — 'Not finding it?' footer click is a no-op

## Gaps

- truth: "Combobox Up/Down arrow keys move focus through result rows; Enter fires onPick on the active row"
  status: failed
  reason: "User reported: down/up arrows don't traverse the options at all - nothing happens. hitting enter just closes the options"
  severity: major
  test: 2
  defect_id: SRCH-02
  hypothesis: |
    @base-ui/react/combobox 1.3.0 ships the WAI-ARIA combobox keyboard contract by
    default, so this failure is structural — the SearchEntry composition isn't using
    the combobox sub-components correctly. Likely root causes (rank-order):
    (a) Result rows render as raw <div> instead of <Combobox.Item> — the activeIndex
        tracker has no items registered, so arrow keys can't move and Enter has
        nothing to commit.
    (b) The keyboard events from the input don't reach the listbox — e.g., the
        Combobox.Root wrapper is missing or `onKeyDown` is intercepted by a parent.
    (c) The `items` prop on Combobox.Root isn't being passed the live results list,
        so the headless state isn't building an index.
    Confirm by grepping src/components/watch/SearchEntry.tsx for Combobox.Item usage
    and the items/onItemsChange props on Combobox.Root.
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Clicking the 'Not finding it? Add manually' footer row expands the inline StructuredEntryPanel with parsed query pre-seeded"
  status: failed
  reason: "User reported: the footer row is visible as expected - clicking it doesn't do anything"
  severity: major
  test: 4
  defect_id: SRCH-03
  hypothesis: |
    The SRCH-24 footer renders (visible per user) but the click handler isn't doing
    anything. Likely root causes:
    (a) Missing or wrong onClick on the footer row — the JSX renders the row but the
        handler that should set forceClose / mount StructuredEntryPanel isn't wired.
    (b) The click is being swallowed by Combobox.List popup behavior — the footer is
        INSIDE the Combobox.List popup (per VERIFICATION.md item 4), and base-ui's
        combobox may eat clicks that aren't on Combobox.Item (consistent with SRCH-02
        — the popup isn't treating non-Item children as interactive).
    (c) The same Combobox.Root composition bug causing SRCH-02 may be the upstream
        cause here too — if the popup isn't routing keyboard events to a tracked
        active item, it may also be intercepting non-Item click events.
    Confirm by grepping src/components/watch/SearchEntry.tsx around the SRCH-24 footer
    row JSX (`Not finding it?` literal); check whether it's inside <Combobox.List> as
    a raw <button> vs. a properly-treated escape-hatch sibling.
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

<!-- Populated as issues are reported -->
