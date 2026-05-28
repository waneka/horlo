# Feature Research

**Domain:** Search-first item creation flow — collection app with reference database
**Researched:** 2026-05-28
**Confidence:** HIGH (grounded in existing codebase + confirmed patterns from Discogs, Letterboxd, Goodreads, Spotify)

---

## Context: What Already Exists

The following are built and MUST NOT be re-implemented. They are dependencies:

- `searchCatalogWatches` DAL — pg_trgm ILIKE over `watches_catalog`; returns `SearchCatalogWatchResult[]` including `viewerState: 'owned' | 'wishlist' | null`; min 2-char threshold already enforced
- `extractWithLlm` — URL-only today; accepts HTML + optional JSON-LD structured context; returns `ExtractedWatchData`
- `WatchForm` — full field editor with `lockedStatus`, `defaultStatus`, `returnTo`, `onWatchCreated`; status is a `<Select>` with all 4 statuses (owned / wishlist / sold / grail)
- `VerdictStep` — shows `CollectionFitCard` + 3-button lock; BEING REPLACED by the new confirm screen
- `PasteSection` — URL paste entry; BEING DEMOTED to secondary path
- `AddWatchFlow` — flow orchestrator state machine; BEING REARCHITECTED
- `upsertCatalogFromTypedInput` CAT-06 DAL — seeds a catalog row from typed brand+model+reference (no URL)
- `initialCatalogId` / `initialCatalogPrefill` deep-link path from `/search` — existing mechanism to jump directly to form-prefill

---

## Feature Landscape

### Category 1: Search Entry

The primary entry point. User types to surface matching `watches_catalog` rows.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Typeahead search input as the first visible element | Discogs, Letterboxd, Goodreads all open on search, not a form. URL-paste as the hero felt unintuitive for "I know what I want" cases | LOW | Replaces `PasteSection` as the idle-state render. Can reuse `searchCatalogWatches` DAL directly via Server Action |
| Results appear at 2+ characters with ~200ms debounce | Industry standard (Meilisearch docs, typeahead.js). Sub-2-char results are noise for a ~100-row catalog | LOW | `SEARCH_WATCHES_TRIM_MIN_LEN = 2` already enforced in the DAL |
| Result rows show brand, model, reference, cover photo | Users scan visually. Discogs shows catalog number + image; Letterboxd shows poster; Goodreads shows cover | LOW | `SearchCatalogWatchResult` already carries `imageUrl`, `brand`, `model`, `reference` |
| "In your collection" badge on results | Discogs shows green owned indicator + red wantlist indicator in search results. Letterboxd shows "Watched" badge. Not showing this is a blind spot | LOW | `viewerState: 'owned' | 'wishlist' | null` already returned by `searchCatalogWatches` — just render it |
| Keyboard navigation through results (Up/Down/Enter) | Combobox accessibility standard per W3C ARIA APG | MEDIUM | Use `role="listbox"` + `role="option"` pattern. Base UI headless primitives may help |
| Clicking a result advances to confirm screen | The expected action in every reference-DB-first collection app | LOW | Result row click → transition to `confirm` state with `catalogId` + prefilled `ExtractedWatchData` from catalog row |

#### Search Ranking

**Confidence: HIGH** — `searchCatalogWatches` already implements this ordering.

Current ranking: popularity DESC (ownersCount + 0.5 * wishlistCount) → alphabetical tie-break. This is the correct order for a sparse catalog. No changes needed.

Tie-breaking for exact reference match: the existing `reference_normalized ILIKE` branch already fires when a reference-pattern match exists. Reference exact-match rows will naturally rank high because they are typically the most popular variant. If a catalog row has `reference = "3135"` and the user types `"3135"`, the DAL will surface it. No additional boosting needed at v8.0 scale (~100 rows).

**"Already in your collection" in results:** `viewerState: 'owned'` should render a visible badge (e.g., "In collection") on the result row. `viewerState: 'wishlist'` should render a subtler badge ("On wishlist"). This prevents the user from accidentally adding duplicates and matches Discogs' green/red indicator pattern.

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Instant result highlighting of matched text | Clarifies why a result appeared; reduces "why is this showing up?" confusion per Meilisearch UX research | MEDIUM | Wrap matched substring in `<mark>` or `<span>` with highlight class. Requires passing the raw query to the result renderer |
| Owners count shown on result | Social proof — "47 collectors own this" nudges confidence. Letterboxd shows watch count; Discogs shows "have" / "want" counts | LOW | `ownersCount` already in `SearchCatalogWatchResult` |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Exact-reference-only filtering (no fuzzy match) | Sounds precise | A collector typing "speedmaster" expects brand+model fuzzy. Reference-exact-only defeats the search-first premise | Keep existing ILIKE fuzzy match across brand, model, and reference |
| Server-side search on every keystroke (no debounce) | Feels more real-time | Hammers the DB; at 200ms debounce the latency is imperceptible | 200ms debounce via Server Action or client-side timer |
| Displaying "sold" status badge on search results | Complete information | Confusing — "you sold this" should not discourage re-adding. Discogs and Goodreads don't show sold/read history in add flows | Only badge `owned` and `wishlist` states, consistent with existing DAL behavior |

---

### Category 2: No-Match Path

When no catalog row matches, the user must be guided toward manual input. This is the critical "what happens at the edge" question.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| "No results" state appears after sufficient typing | Empty state after 3+ characters typed with no results. Appearing immediately on focus with an empty query confuses users who have not yet searched | LOW | Show empty state when query.length >= 3 AND results.length === 0. Below 3 chars: show nothing (or a hint like "Type to search") |
| "Not finding it? Add it manually" CTA in the no-result state | Discogs' fallback: "Can't find it? Submit a new release." Goodreads: "Add a book manually." Industry standard for reference-DB-first apps | LOW | CTA transitions to the structured-input screen (Category 3), pre-seeding the search query as brand/model hint |
| URL paste demoted to secondary option within the no-result state | URL paste is still valid and useful for verified product pages, but should not be the headline path | LOW | "Or paste a product page URL" link in the no-match panel, consistent with SEED-010 "URL extraction as second tier" |
| Search query pre-seeds the manual entry fields | If user typed "omega speedmaster 3135", that text should pre-fill the brand/model inputs on the structured-input screen | LOW | Pass the raw query string to the structured-input screen as a seed prop |

**No-result threshold decision:** Show the "no match" state at query length >= 3, not at 2. Rationale: 2-character queries return too many partial matches to be meaningful (e.g., "ro" matches Rolex + Rado + Rotary). The no-result state at 3+ chars is specific enough that "nothing matched" is informative, not premature. The DAL already fires at >= 2 chars, so the component just needs to gate the empty state display.

**Mid-typing nudge:** Do NOT show "no results" between keystrokes (mid-debounce). Show it only after the debounce fires and the DAL returns empty. Showing it mid-typing would flash misleadingly.

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Inline "not finding it?" nudge in the results list (appears below partial matches) | When 1-2 low-confidence results exist, the user may not want any of them. A persistent footer row "Add something else" lets them escape without clearing the field | LOW | Append a static "Not finding it? Add manually" list item below results, always visible when results.length > 0 too |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| "No results" immediately on focus (before any typing) | Appears to fill empty space | Confusing — user has not searched yet | Show no-result state only after >= 3 chars typed |
| Suggest "did you mean X" fuzzy correction | Feels polished | At ~100 catalog rows, there is no meaningful corpus for suggestion generation. Would require Levenshtein or pg_similarity tuning not yet in place | Plain "not found, add manually" is sufficient for v8.0 |
| Force user through URL paste before manual entry | Preserves existing URL path revenue | Contradicts the SEED-010 goal of making URL-paste secondary. Collects frustrate easily | URL paste is one of two options in the no-match panel, not a gate |

---

### Category 3: Structured-Input Extraction Screen

When no catalog row matches and the user wants LLM-powered field inference rather than pure manual entry, they land here. This is the "no-URL extraction" mode described in SEED-010.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Brand + Model as required fields | Minimum viable context for LLM to infer anything useful. Brand alone is not enough (too many models); model alone is ambiguous. The route handler today gates on brand AND model being non-empty before running the catalog upsert | LOW | Two required text inputs. Inline validation before LLM call |
| Reference as optional field | Collectors know their reference numbers. Providing it dramatically improves catalog uniqueness and LLM inference accuracy | LOW | Optional text input, pre-filled from search query if it looked like a reference number |
| Year as optional field | Distinguishes vintage from modern variants ("1969 Speedmaster" vs current). LLM can infer era from year even without a URL | LOW | Optional 4-digit year input; maps to `productionYear` in the Watch type |
| LLM infers: movement, case size, complications, dial color, water resistance, crystal, style/design tags | These are the fields the LLM is good at inferring from brand+model knowledge. The existing `extractWithLlm` already extracts all of these from HTML; a no-URL mode needs a new prompt variant that works from named specs instead of page text | MEDIUM | New server action or route mode: POST brand+model+ref+year → LLM prompt → `ExtractedWatchData`. See Extraction Integration section |
| User fills in: price paid, purchase date, notes, provenance | Personal financial data the LLM cannot know. These belong on the confirm screen, not the extraction screen | LOW | Do not put price/provenance fields on the extraction screen |
| Loading state while LLM runs | LLM calls take 1-5s. Users need feedback. The existing `VerdictSkeleton` establishes this pattern | LOW | Reuse or clone the existing skeleton/spinner pattern |

**What the LLM infers vs what the user fills in:**

The split is: LLM handles factual/catalog data (specs, tags, role) that can be inferred from the watch's identity. The user handles personal/acquisition data that is private and unknowable from the watch's identity.

| LLM infers | User fills in |
|------------|---------------|
| movement type | status (owned/wishlist/grail) |
| case size, lug-to-lug | price paid / target price |
| water resistance | purchase date |
| crystal type | condition grade |
| dial color | serial number |
| complications | box/papers status |
| style tags, design traits | notes |
| market price estimate | service history |

**Extraction prompt strategy for no-URL mode:** The existing `extractWithLlm` function operates on HTML page text. A no-URL mode needs a different prompt: instead of "here is page text, extract specs," it should say "here is a watch identity (brand, model, reference, year), fill in the known technical specs from your training knowledge." This is a new prompt variant — not a modification of the HTML extraction prompt. The route handler at `/api/extract-watch` currently validates a `url` string; the no-URL mode would need either a new route or a route mode flag. HIGH confidence that the LLM can produce accurate specs from brand+model alone for well-known watches; LOW confidence for obscure references.

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Optional photo upload on the structured-input screen | Collector provides a photo of the watch box or dial; LLM uses it to confirm or fill specs. Already architected in Phase 19.1 D-19 for the manual path | MEDIUM | The existing `CatalogPhotoUploader` on `WatchForm` handles this. Whether to surface it on the extraction screen (before confirm) vs defer to the photos-pending step (after confirm) is a UX call — defer is simpler |
| Show what the LLM could not infer | "I found: movement auto, 42mm case, sapphire crystal. I couldn't determine: dial color, complications." Transparency builds trust | LOW | Diff the returned `ExtractedWatchData` fields against a "known" field list and surface gaps |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full WatchForm on the extraction screen | Seems complete | The extraction screen is meant to be a quick "give me enough to run the LLM" step, not the full 20-field form. Showing everything at once discourages completion | Keep extraction screen to 4 fields max (brand, model, ref, year); full editing happens on confirm screen |
| Requiring reference or year before allowing extraction | Precise inputs improve LLM output | Many collectors don't know the reference number. Brand+model alone is sufficient for well-known watches | Make reference and year optional; show them as "helps us find specs" hint text |
| Running extraction on every keystroke as the user types brand/model | Feels magical | LLM calls at $0.003/1K tokens become expensive fast; user experience degrades with mid-sentence extractions | Require explicit "Find specs" button press |

---

### Category 4: Confirm Screen

After catalog match OR after LLM extraction, the user reviews the watch before adding it. This replaces the existing `VerdictStep` in the add flow.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Cover photo at top | Letterboxd shows poster; Discogs shows sleeve art. Visual confirmation this is the right watch | LOW | Use catalog `imageUrl` or extracted `imageUrl`. If both null, render a watch-icon placeholder. No upload here — that's the photos-pending step after commit |
| Brand, model, reference displayed prominently | User must confirm identity before adding | LOW | Read-only display, same as existing `VerdictStep` spec preview card |
| Status picker (owned / wishlist / grail) | THIS IS THE KEY REPLACEMENT for the 3-button `VerdictStep`. The user picks their intent here. Grail must be available — today the URL-extract path can never set grail (SEED-010 triage note #7) | MEDIUM | See Status Picker section below |
| Inline editable fields: price paid / target price (status-gated) | Price paid for owned; target price for wishlist/grail. Small but important for financial tracking | LOW | Same status-conditional logic already in `WatchForm` (`isOwned` flag); keep it |
| "Edit all details" affordance that opens the full WatchForm | The confirm screen is intentionally lighter. Users who want to edit caliber, lug-to-lug, complications, or provenance should have a path | LOW | "Edit details" link or secondary button → transitions to full `WatchForm` with all extracted data pre-filled; `lockedStatus` is NOT set (user can still change) |
| "Add to collection / wishlist / grail" primary action button | Label should reflect the chosen status | LOW | Confirm button label: "Add to Collection" / "Add to Wishlist" / "Save as Grail" |
| "Start over" escape | Users may realize they found the wrong watch | LOW | Link back to search idle state |

**Confirm screen field set — what's visible vs hidden:**

Visible on confirm (lightweight review path):
- Cover photo
- Brand / model / reference (read-only, with edit link)
- Status picker
- Price paid (if owned) or target price (if wishlist/grail)
- Acquisition date (if owned) — already a Phase 37 field, and collectors note purchase date at point of adding

Hidden behind "Edit details" (full WatchForm):
- Movement, case size, lug-to-lug, water resistance, crystal, dial color
- Complications, style tags, design traits, role tags
- Chronometer flag
- Provenance (condition, serial, box/papers, service history)
- Notes, notesPublic
- Market price estimate

This split follows the Discogs pattern (add immediately, edit details later) and the Letterboxd pattern (log it now, add more context later).

**CollectionFitCard is NOT on the confirm screen.** Operator decision from SEED-010 milestone context. Verdict lives on `/w/[ref]` only.

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Inline reference + year edit on confirm screen | Small correction without leaving the screen — user typed "3135" and the LLM found "3135-0013". Let them fix it inline | MEDIUM | Editable text input for reference and year on the confirm screen, distinct from full WatchForm editing |
| Optimistic commit with undo toast | "Added to collection. Undo?" — Spotify does this for library actions. Faster perceived performance | HIGH | Requires rollback API; deferred |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| CollectionFitCard on the confirm screen | Shows fit context before committing | Operator decision: verdict lives on /w/[ref] only. Including it here violates the milestone scope and adds LLM round-trip latency | Removed per SEED-010 decision |
| Full WatchForm as the confirm screen | No separate "confirm" concept | The verdict step is being replaced specifically because the current form-prefill requires lockedStatus — grail is blocked on the URL-extract path. A lighter confirm screen is the fix | Use WatchForm via "Edit details" affordance, not as the primary confirm surface |
| Separate notes textarea on the confirm screen | "Add a note while it's fresh" | Notes belong in the full form; adding them to confirm bloats the screen and invites essays | Notes available in "Edit details" path |

---

### Category 5: Status Selection

How the user picks owned / wishlist / grail. This is the replacement for the 3-button VerdictStep row.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| All four statuses accessible at add time | Today, the URL-extract path cannot set grail (only wishlist or collection via VerdictStep). This is the primary UX bug SEED-010 exists to fix | LOW | Expose grail as a first-class option alongside owned and wishlist |
| Status picker lives on the confirm screen | Not on the search results page; not on the extraction screen. After the user has identified the watch is the natural decision point | LOW | Confirm screen is the home |
| "Sold" status NOT shown on add flow | You don't add a watch as "already sold" | LOW | `WATCH_STATUSES` includes sold, but the add-flow status picker should show only owned / wishlist / grail. Sold is an edit-mode status for watches that have transitioned. WatchForm in edit mode retains all 4 |

**Status picker component choice:** A segmented control / button group (not a Select dropdown). Rationale:

- 3 options (owned, wishlist, grail) fit inline horizontally on mobile without overflow
- Visual distinctness between options communicates the mutual-exclusivity better than a dropdown
- Shadcn/Base UI provide ButtonGroup primitives; shadcnblocks has ready-made button group components
- Segmented controls are appropriate for "small sets of mutually exclusive options (2-5)" per Gravity UI + Atlassian design system research

**Grail visual treatment:** Grail should be visually distinct — not just a 4th radio button. Rationale: grail is a rare personal designation (collectors typically have 1-3 grail watches total). Discogs uses no visual distinction for wantlist vs "rare" items, but watch-collecting culture treats grail as a special category. Recommended: a subtle gem/star icon next to the "Grail" label in the segmented control; the option itself is not visually elevated (same size, same interactive weight) but carries an icon marker. This is a differentiator for Horlo vs generic collection apps.

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Grail icon marker in the status picker | Communicates the rarity/aspiration of the designation without being precious about it | LOW | Single icon (e.g. `Star` from lucide-react) inline with "Grail" label text |
| Status default derived from search intent | If user arrived from `/watch/new?status=wishlist` (e.g., from the wishlist empty-state CTA), pre-select wishlist in the picker | LOW | Thread `initialStatus` through to the confirm screen default, same as existing `defaultStatus` prop on WatchForm |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| "Sold" in the add-flow status picker | Completeness | Adding a watch as "sold" implies it was never owned, which conflicts with the provenance model. Sold is a transition state, not an initial state | Omit from add flow; available in edit mode |
| Status as a dropdown Select on the confirm screen | Familiar from WatchForm | Dropdown requires an extra tap to open. 3-option segmented control is faster and the mutual exclusivity is visually obvious | ButtonGroup / segmented control |
| Requiring rationale notes for wishlist (current WishlistRationalePanel) | Intentional friction to prompt reflection | The rationale panel adds a step that is good for the URL-extract path but is friction in the search-first flow where the user already found the watch intentionally | Remove WishlistRationalePanel from the new flow; notes remain available in "Edit details" |

---

### Category 6: Existing-in-Collection Handling

What happens when the user finds a catalog row they already own.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| "In your collection" badge on search result | See Category 1. Prevents accidental duplicates | LOW | `viewerState: 'owned'` badge on the result row |
| Clicking an "owned" result advances to the watch's detail page, not the add flow | Discogs navigates to the collection item when you click an owned release in search. Letterboxd shows your review when you click an already-logged film | MEDIUM | If `viewerState === 'owned'`, result click should route to `/w/[ref]` instead of advancing the add flow. Requires looking up the user's watch ID from the catalog ID |
| "Add again as second watch" escape | Some collectors own two of the same reference | LOW | On the confirm screen, if the watch is already in the collection, show a secondary "I have another one" affordance that bypasses the detail-page redirect |

**"On wishlist" handling:** If `viewerState === 'wishlist'`, the result click should advance to the confirm screen with `status` defaulting to `wishlist` (same watch, user may be converting to owned or adjusting). A "Already on your wishlist — move to collection?" framing on the confirm screen is the appropriate nudge.

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Move to collection" shortcut on the confirm screen for wishlist items | Collector bought the watch — one tap converts it | MEDIUM | Requires knowing the existing watch ID. Pre-fill confirm with current wishlist data; on commit, UPDATE status rather than INSERT new row |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Blocking the add flow entirely when a watch is already owned | Prevents duplicates | Over-aggressive. Some duplicates are legitimate (collectors own multiple references, or buy the same watch twice). A warning is enough | Show badge + warn, don't block |

---

### Category 7: Catalog-Only Match (No User Copy)

When the catalog has a row but the user does not own or wishlist it.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Clean CTA: "Add to Collection" or "Add to Wishlist" on confirm screen | No state to communicate — just a clean add affordance | LOW | Standard confirm screen with no badge/warning; status picker defaults to owned |
| Catalog data pre-fills the confirm screen | The whole value proposition of search-first: catalog data populates brand, model, ref, image, and known specs | LOW | Build `ExtractedWatchData` from the catalog row fields when advancing from a search result (same as existing `initialCatalogPrefill` mechanism) |

---

### Category 8: Legacy Path Cleanup

Changes to the existing URL-paste and manual-entry paths.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| URL paste remains accessible as a secondary path | Some collectors have URLs; the URL path produces better spec data for known product pages | LOW | Surface URL paste in the no-match panel (see Category 2) as "Or paste a product page URL" |
| "Skip search — enter manually" link remains | Power users; edge cases; watches with no URL and exotic enough that brand+model LLM inference would fail | LOW | Rename the existing "or enter manually" link to "Skip search — enter manually" and position it below the search input in idle state |
| WishlistRationalePanel removed from the new flow | The rationale step was designed for the URL-extract verdict flow (deliberate friction before wishlist commit). The search-first confirm screen replaces the VerdictStep, making the rationale panel redundant | LOW | Stop rendering `WishlistRationalePanel` in the new flow; the notes field remains available in "Edit details" / `WatchForm` |
| `VerdictStep` state machine states removed from `flowTypes` | Dead code after the redesign; `verdict-ready`, `wishlist-rationale-open`, `submitting-wishlist` states belong to the old flow | MEDIUM | Clean up `FlowState` union type; add new states: `search-idle`, `search-results`, `structured-input`, `extracting-structured`, `confirming` |
| `RecentlyEvaluatedRail` removed or repurposed | The rail showed recently extracted (verdict-evaluated) watches. In the new flow, there is no verdict step in the add flow | LOW | Remove from the new AddWatchFlow or repurpose as "Recently searched" chips if a session history is desired |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Keeping VerdictStep in the new flow for URL-extract path | Avoids breaking the URL path | VerdictStep's 3-button lock is the exact problem being solved (grail blocked). The URL path must flow through the new confirm screen with status picker | URL-extract path → new confirm screen with status picker; VerdictStep is retired |
| Keeping WishlistRationalePanel | Preserves deliberate add friction | Friction is right for the URL "evaluate then decide" flow; wrong for the search-first "I know what I want" flow. Two paths, two interaction models | Rationale panel gone from add flow; notes field survives in WatchForm |

---

## Feature Dependencies

```
Search Entry (Category 1)
    └──no match──> No-Match Path (Category 2)
                       └──structured input CTA──> Structured-Input Extraction Screen (Category 3)
                       └──URL paste CTA──> [existing URL extract path, demoted]
                       └──skip search CTA──> [existing manual WatchForm, renamed]

Search Entry (Category 1)
    └──result selected──> Confirm Screen (Category 4)
                              └──requires──> Status Selection (Category 5)
                              └──requires──> Existing-in-Collection Handling (Category 6)
                              └──requires──> Catalog-Only Match handling (Category 7)
                              └──"Edit details"──> WatchForm [existing, unchanged]
                              └──commit──> WatchPhotoStep [existing, unchanged]

Legacy Path Cleanup (Category 8)
    ──depends on──> all above categories being shipped first
```

### Dependency Notes

- **Confirm Screen (4) requires Status Selection (5):** The confirm screen is not useful without the status picker. They ship together.
- **Structured-Input Extraction (3) requires a new server action / route mode:** `extractWithLlm` today takes HTML. The no-URL mode needs a different prompt. This is the highest-implementation-complexity item in the milestone.
- **Existing-in-Collection Handling (6) requires a watch-ID lookup by catalog ID:** If clicking an owned result should route to `/w/[ref]`, we need to resolve the user's watch record from the catalog ID. `searchCatalogWatches` does not return the user's watch ID — only `viewerState`. A supplemental DAL query is needed.
- **Legacy Path Cleanup (8) ships last:** Clean up after all new surfaces are working.

---

## NOT Building (Explicit Anti-Scope)

These are out of scope for v8.0 per the milestone brief. Document to prevent scope creep:

- **CollectionFitCard in the add flow** — Operator decision. Verdict lives on `/w/[ref]` only. No changes to how CollectionFitCard works.
- **Changes to `/w/[ref]` or the detail page** — Out of scope this milestone.
- **Catalog expansion** — v9.0 (SEED-009 unscheduled). v8.0 ships against the ~100-row catalog.
- **Multi-watch batch add** — Not in SEED-010.
- **Optimistic commit with undo** — HIGH complexity; deferred.
- **"Did you mean" fuzzy correction** — Insufficient catalog corpus at v8.0 scale.
- **Wantlist-to-collection conversion shortcut** (Category 6 differentiator) — MEDIUM complexity; flag as a stretch goal, not a v8.0 requirement.
- **Sold status in add flow** — Edit mode only.

---

## MVP Definition

### Must Ship (v8.0 table stakes)

- [ ] Search input as primary entry — replaces PasteSection hero position
- [ ] Typeahead results at 2+ chars with 200ms debounce
- [ ] "In collection" / "On wishlist" viewerState badges on results
- [ ] No-match state at 3+ chars with "Add manually" CTA and "Paste URL" secondary
- [ ] Search query seeds structured-input screen fields
- [ ] Structured-input screen: brand + model required, reference + year optional
- [ ] New server action / route mode for no-URL LLM extraction (brand+model+ref+year → ExtractedWatchData)
- [ ] Confirm screen: cover photo, brand/model/ref, status picker (owned/wishlist/grail), price field (status-gated)
- [ ] Status picker as segmented control / button group (not Select dropdown)
- [ ] Grail icon marker in status picker
- [ ] "Edit details" affordance → full WatchForm
- [ ] "Add to collection" label reflects chosen status
- [ ] Clicking owned result → detail page redirect (not add flow)
- [ ] "Skip search — enter manually" link below search input
- [ ] URL paste available in no-match panel
- [ ] VerdictStep retired from add flow
- [ ] WishlistRationalePanel retired from add flow
- [ ] FlowState type updated; dead states removed
- [ ] RecentlyEvaluatedRail removed from new flow

### Add After Validation (stretch / v8.x)

- [ ] Inline reference + year edit on confirm screen
- [ ] "Move to collection" shortcut for wishlist → owned conversion
- [ ] Matched text highlighting in results

### Future Consideration (v9+)

- [ ] Optimistic commit with undo toast
- [ ] "Did you mean" fuzzy correction (needs catalog depth)
- [ ] Batch multi-watch add

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Search input as hero entry | HIGH | LOW | P1 |
| viewerState badges on results | HIGH | LOW | P1 |
| No-match + "add manually" CTA | HIGH | LOW | P1 |
| Confirm screen with status picker | HIGH | MEDIUM | P1 |
| Grail in status picker | HIGH | LOW | P1 |
| No-URL LLM extraction (new route mode) | MEDIUM | MEDIUM | P1 |
| VerdictStep / WishlistRationalePanel removal | HIGH | MEDIUM | P1 |
| Clicking owned result → detail page | MEDIUM | MEDIUM | P2 |
| Inline editable ref/year on confirm | MEDIUM | MEDIUM | P2 |
| Text highlight in results | LOW | MEDIUM | P3 |
| "Move to collection" shortcut | MEDIUM | HIGH | P3 |

---

## Competitor / Reference App Analysis

| Feature | Discogs | Letterboxd | Goodreads | Horlo v8.0 |
|---------|---------|------------|-----------|------------|
| Add entry point | Search first | Search first | Search first | Search first (replacing URL-paste hero) |
| Result badges (already owned) | Green owned, red wantlist | "Watched" indicator | Shelf indicator | "In collection" / "On wishlist" via viewerState |
| No-match path | "Submit new release" | Not applicable (TMDB is authoritative) | "Add manually" | Structured-input screen → LLM extraction |
| Confirm screen | Release detail page (full info) | Lightweight log modal (rating + date) | Lightweight shelf-add modal | Lightweight confirm (photo, identity, status, price) with "Edit details" escape |
| Status selection | Collection folder picker (multi-select) | "Watched" / "Watchlist" / "Liked" | "Read" / "To-read" / "Currently reading" | Owned / Wishlist / Grail (segmented control) |
| Duplicate handling | Warning + count badge | Blocks duplicate (one log per film) | Allows multi-shelf | Badge warning; redirect to detail for owned |

---

## Sources

- Discogs support docs: "How Does The Collection Feature Work" — https://support.discogs.com/hc/en-us/articles/360007331534
- Discogs community: catalog-first add + owned indicator pattern — forum observations
- Letterboxd journal: search improvements, TMDB-backed reference DB — https://letterboxd.com/journal/how-to-use-our-new-and-improved-search/
- Meilisearch UX guide: 200ms debounce, 5-10 suggestions, highlight matches — https://www.meilisearch.com/blog/typeahead-search
- W3C ARIA APG: Radio Group pattern, Combobox accessible keyboard nav — https://www.w3.org/WAI/ARIA/apg/patterns/radio/
- Gravity UI / Atlassian: segmented control for 2-5 mutually exclusive options — https://gravity-ui.com/design/guides/segmented-radio-group
- Smart Interface Design Patterns: autocomplete UX, show suggestions on focus — https://smart-interface-design-patterns.com/articles/autocomplete-ux/
- Horlo codebase: `searchCatalogWatches` DAL (SRCH-09/10), `SearchCatalogWatchResult` type, `extractWithLlm`, `AddWatchFlow`, `VerdictStep`, `WatchForm`, `WATCH_STATUSES` — direct source read
- SEED-010: v8.0 Add-Watch Redesign brief — `.planning/seeds/SEED-010-v5.3-add-watch-redesign.md`

---
*Feature research for: Horlo v8.0 Add-Watch Redesign — search-first add flow*
*Researched: 2026-05-28*
