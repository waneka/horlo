---
status: diagnosed
trigger: "On /watch/new, after the user clicks 'or enter manually' to bypass the URL extract step, there is no visible affordance to back out of manual-entry mode and return to the URL extract flow without refreshing the page."
created: 2026-04-30T18:00:00Z
updated: 2026-04-30T18:05:00Z
---

## Current Focus

hypothesis: CONFIRMED — AddWatchFlow's `manual-entry` render branch (lines 354-361) renders only `<WatchForm>` with no surrounding chrome. There is no "Cancel" / "Use URL instead" affordance, and no FlowState transition wired from `manual-entry` back to `idle`. The state machine only has entry edges INTO manual-entry (handleManualEntry at line 252; handleContinueManually at line 256); there is no exit edge.
test: Done — read AddWatchFlow.tsx fully; confirmed all FlowState transitions and render branches.
expecting: Done.
next_action: Return ROOT CAUSE FOUND diagnosis (mode = find_root_cause_only).

## Symptoms

expected: Once in manual-entry mode (WatchForm visible after clicking "or enter manually"), the user must have a discoverable, in-page way to switch back to the URL extract flow — e.g. a "Cancel", "Use URL instead", or back-link affordance — without needing to refresh the page.
actual: User reports: "once you click 'enter manually' i don't see a way to close the manual upload and get back to the extract url flow, i had to refresh the page".
errors: None — this is a missing UI affordance, not a runtime error.
reproduction: Test 4/5 in 20.1-HUMAN-UAT.md — on /watch/new, click "or enter manually" below the URL input and observe that there is no way back to the URL flow.
started: Discovered during 20.1 UAT (2026-04-30). Manual-entry inline link was a 20.1 deliverable.

## Eliminated

(none — diagnosis-only mode, hypothesis confirmed on first read)

## Evidence

- timestamp: 2026-04-30T18:04:00Z
  checked: Knowledge base (.planning/debug/knowledge-base.md)
  found: One entry (notifications-revalidate-tag-in-render). No keyword overlap with manual-entry / WatchForm / AddWatchFlow / FlowState.
  implication: No prior pattern match; investigate fresh.

- timestamp: 2026-04-30T18:04:30Z
  checked: src/components/watch/AddWatchFlow.tsx (full file, 481 LOC)
  found: FlowState union has 9 states. Entry edges INTO manual-entry exist via handleManualEntry (line 252-254) called from PasteSection's "or enter manually" link, and handleContinueManually (line 256-259) called from extraction-failed branch. NO exit edge from manual-entry exists.
  implication: State machine is intentionally one-way for manual-entry; was treated as a terminal branch where user submits the form to leave.

- timestamp: 2026-04-30T18:04:45Z
  checked: AddWatchFlow.tsx render branches (lines 277-411)
  found: The manual-entry render branch (lines 354-361) renders ONLY <WatchForm mode="create" watch={state.partial ? extractedToPartialWatch(state.partial, 'wishlist') : undefined} />. No surrounding chrome — no Cancel button, no "Use URL instead" link, no header text, no Card wrapper.
  implication: User has no in-page affordance to return to idle. WatchForm has its own "Cancel" button but it routes to /watches (router.back equivalent), not back to idle within /watch/new.

- timestamp: 2026-04-30T18:05:00Z
  checked: AddWatchFlow.tsx — handleStartOver (lines 261-264) and its consumers
  found: handleStartOver already implements the correct "go back to idle" logic (clears url, sets state to idle). It is currently only wired to the extraction-failed branch's "Try another URL" Button (line 396-398). It is NOT wired into the manual-entry render branch.
  implication: The fix is purely additive — the state-transition function already exists; only a JSX surface to invoke it is missing. No new state-machine logic required.

- timestamp: 2026-04-30T18:05:00Z
  checked: 20.1-04-SUMMARY.md state machine reference (lines 134-162)
  found: Documented manual-entry exit as "(back via WatchForm submit/router.back)" — i.e. the spec assumed exit only via form submission or browser back navigation; no explicit in-page back affordance was specified.
  implication: This is a spec gap, not an implementation bug. Plan 04 implemented exactly what was designed; the design itself omitted the back affordance.

## Resolution

root_cause: |
  AddWatchFlow's `manual-entry` render branch (src/components/watch/AddWatchFlow.tsx:354-361) renders the WatchForm without any surrounding affordance to return to the URL-extract flow. The FlowState state machine only defines entry edges INTO manual-entry (from idle via "or enter manually" link, from extraction-failed via "Continue manually"); no exit edge back to idle is wired up. Plan 04's state-machine reference (20.1-04-SUMMARY.md:142) documented manual-entry exits as "(back via WatchForm submit/router.back)" — meaning the design itself treated manual-entry as a one-way terminal branch. This is a spec gap inherited from the 20.1 UI-SPEC, not an implementation defect — Plan 04 built exactly what was designed.

  The handleStartOver helper (lines 261-264) already implements the correct idle-restore logic (clears url, transitions to {kind: 'idle'}); it is currently consumed only by the extraction-failed branch's "Try another URL" button. The fix is purely additive: surface a "Cancel" / "Use URL instead" button in the manual-entry render branch that calls handleStartOver.

fix: (deferred — find_root_cause_only mode)
verification: (deferred — find_root_cause_only mode)
files_changed: []
