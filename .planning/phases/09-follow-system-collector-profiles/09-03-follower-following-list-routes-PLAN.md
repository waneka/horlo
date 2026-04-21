---
phase: 09-follow-system-collector-profiles
plan: 03
type: execute
wave: 3
depends_on: [09-02-follow-button-and-header-wiring-PLAN]
files_modified:
  - src/app/u/[username]/followers/page.tsx
  - src/app/u/[username]/following/page.tsx
  - src/components/profile/FollowerListCard.tsx
  - src/components/profile/FollowerList.tsx
  - src/components/profile/AvatarDisplay.tsx
  - tests/components/profile/FollowerListCard.test.tsx
autonomous: true
requirements: [FOLL-04]
must_haves:
  truths:
    - "Visiting /u/[username]/followers shows page heading 'Followers' and lists every account that follows the profile owner, ordered by most-recent follow first"
    - "Visiting /u/[username]/following shows page heading 'Following' and lists every account that the profile owner follows"
    - "Each row displays avatar (40px), displayName OR @username (fallback, not both side-by-side), optional bio (1 line truncated), watch count plus wishlist count"
    - "Each row is clickable as a link to /u/{other}/collection — keyboard and mouse both work"
    - "Each row has an inline FollowButton (outline variant) that does NOT navigate when clicked (stopPropagation per D-14)"
    - "The FollowButton is hidden on rows representing the viewer themselves (isOwnRow true — D-12)"
    - "Empty state on /followers renders 'No followers yet.' in a bg-card border py-12 card"
    - "Empty state on /following renders '{displayName or @username} isnt following anyone yet.' in the same card treatment"
    - "Private-profile entry in a list shows username + avatar but NO bio and NO watch/wishlist counts (T-09-06 mitigation)"
    - "The route returns Next.js notFound() when the username does not resolve to a profile (same 404 as missing profile, no existence disclosure)"
    - "Each row navigates to /u/{username}/collection (explicit default-tab link, skips redirect hop — D-14)"
  artifacts:
    - path: "src/app/u/[username]/followers/page.tsx"
      provides: "Server Component at /u/[username]/followers. Fetches getFollowersForProfile and hydrates viewerIsFollowing per-row via batched isFollowing reads."
    - path: "src/app/u/[username]/following/page.tsx"
      provides: "Server Component at /u/[username]/following with the mirror DAL call."
    - path: "src/components/profile/FollowerListCard.tsx"
      provides: "Client Component — one row, Link overlay + inline FollowButton with stopPropagation."
      exports: ["FollowerListCard"]
    - path: "src/components/profile/FollowerList.tsx"
      provides: "Server Component — maps DAL result into FollowerListCard rows and renders empty state."
      exports: ["FollowerList"]
    - path: "src/components/profile/AvatarDisplay.tsx"
      provides: "Extended size union to include 40 (for list rows per UI-SPEC) — existing 64 and 96 preserved."
    - path: "tests/components/profile/FollowerListCard.test.tsx"
      provides: "RTL tests covering row rendering, empty-state, private-profile masking, own-row FollowButton hidden."
      contains: "describe('FollowerListCard'"
  key_links:
    - from: "src/app/u/[username]/followers/page.tsx"
      to: "src/data/follows.ts::getFollowersForProfile"
      via: "server-side single-query DAL call"
      pattern: "getFollowersForProfile\\(profile\\.id\\)"
    - from: "src/app/u/[username]/following/page.tsx"
      to: "src/data/follows.ts::getFollowingForProfile"
      via: "server-side single-query DAL call"
      pattern: "getFollowingForProfile\\(profile\\.id\\)"
    - from: "src/components/profile/FollowerListCard.tsx"
      to: "src/components/profile/FollowButton.tsx"
      via: "inline variant plus stopPropagation wrapper"
      pattern: "variant=\"inline\""
    - from: "src/components/profile/FollowerListCard.tsx"
      to: "next/link"
      via: "Link href=/u/{username}/collection"
      pattern: "/collection"
---

<objective>
Deliver the follower and following list routes at `/u/[username]/followers` and `/u/[username]/following`. Each page is a Server Component that:
1. Resolves the owner profile via `getProfileByUsername(username)` (404 when missing — matches Phase 8 Letterboxd pattern).
2. Fetches the list via `getFollowersForProfile(profile.id)` or `getFollowingForProfile(profile.id)` (single-query join from Plan 01 — no N+1).
3. For each listed user, resolves whether the CURRENT VIEWER is following that user, so each FollowButton hydrates to correct initial state.
4. Renders `FollowerList` which maps rows into `FollowerListCard` (Client Component) with avatar + name + bio + stats + inline FollowButton.
5. Empty states handled per UI-SPEC copywriting contract.

No new DAL functions beyond Plan 01. Only one existing file is touched (AvatarDisplay, to add a size=40 variant for 40px list-row avatars per UI-SPEC); everything else is new.

Output: two new route pages, three new components (FollowerList, FollowerListCard, and an extension to AvatarDisplay), and component-level test coverage.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-follow-system-collector-profiles/09-CONTEXT.md
@.planning/phases/09-follow-system-collector-profiles/09-RESEARCH.md
@.planning/phases/09-follow-system-collector-profiles/09-UI-SPEC.md
@.planning/phases/09-follow-system-collector-profiles/09-VALIDATION.md
@.planning/phases/09-follow-system-collector-profiles/09-01-SUMMARY.md
@.planning/phases/09-follow-system-collector-profiles/09-02-SUMMARY.md
@CLAUDE.md
@AGENTS.md

<interfaces>
From src/data/follows.ts (Plan 01):
- Type FollowerListEntry: { userId, username, displayName|null, bio|null, avatarUrl|null, profilePublic, watchCount, wishlistCount, followedAt (ISO string) }
- getFollowersForProfile(userId): Promise of FollowerListEntry[]
- getFollowingForProfile(userId): Promise of FollowerListEntry[]
- isFollowing(followerId, followingId): Promise of boolean

From Plan 02 (already landed):
- src/components/profile/FollowButton.tsx — named export FollowButton with props: { viewerId: string|null, targetUserId: string, targetDisplayName: string, initialIsFollowing: boolean, variant?: 'primary' | 'locked' | 'inline' }

From src/data/profiles.ts (existing):
- getProfileByUsername(username): Promise of profile or null

From src/lib/auth.ts:
- getCurrentUser(): Promise of { id, email }
- UnauthorizedError class

From src/components/profile/AvatarDisplay.tsx (current — must extend):
- Current prop: size?: 64 | 96 (default 64)
- Extend to size?: 40 | 64 | 96; when size === 40 use Tailwind class `size-10` and initial font size `text-sm`

Next.js 16 App Router patterns (VERIFIED at node_modules/next/dist/docs/):
- params is a Promise — must `await params` in page components (mirror existing src/app/u/[username]/[tab]/page.tsx line 37)
- Server Components fetch DAL directly
- import notFound from 'next/navigation' for 404
- Page files at: src/app/u/[username]/followers/page.tsx and src/app/u/[username]/following/page.tsx — each export default async function

UI-SPEC copywriting (from 09-UI-SPEC.md):
- Heading: "Followers" / "Following" (exact)
- Subheading: "{displayName or @username}'s followers" / "{displayName or @username} is following"
- Empty (others, zero followers): "No followers yet."
- Empty (others, zero following): "{displayName or @username} isnt following anyone yet."
- Empty (own, zero followers): "You dont have any followers yet."
- Empty (own, zero following): "You arent following anyone yet."
- Row stats: "N watches · M wishlist"
- Relative time on /followers only: "N days ago" from followedAt with pluralization
- Aria label on Link overlay: `View {displayName or @username}'s profile`

UI-SPEC visuals:
- Row min-height 72px (py-4 + 40px avatar)
- Row container classes: `flex items-center gap-4 py-4 border-b border-border`
- Avatar component: AvatarDisplay size=40
- Primary label: `text-sm font-semibold text-foreground`
- Bio: `text-xs text-muted-foreground truncate`
- Stats: `text-xs text-muted-foreground`
- Inline FollowButton: height 32px desktop / 40px mobile — uses variant="inline" from Plan 02
- Row ordering: ORDER BY follows.created_at DESC (already in DAL)
- No pagination (D-13)
- Page gutter container: `mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend AvatarDisplay size union + write failing FollowerListCard tests</name>
  <files>src/components/profile/AvatarDisplay.tsx, tests/components/profile/FollowerListCard.test.tsx</files>
  <read_first>
    - src/components/profile/AvatarDisplay.tsx (current: size 64 | 96; must add 40)
    - src/components/profile/FollowerListCard.tsx (verify does NOT yet exist)
    - .planning/phases/09-follow-system-collector-profiles/09-UI-SPEC.md (Follower / following list page layout section — specifies 40px avatar, aria-label on Link overlay, row structure)
    - tests/components/profile/LockedProfileState.test.tsx (RTL precedent)
    - tests/components/profile/FollowButton.test.tsx (RTL mocking pattern for @/app/actions/follows + next/navigation)
    - .planning/phases/09-follow-system-collector-profiles/09-RESEARCH.md (Pattern 6 lines ~398-440 for FollowRow reference implementation; Pitfall 6 for Link-overlay accessibility concern)
  </read_first>
  <behavior>
    Step A — Extend AvatarDisplay:
    - Prop type becomes size?: 40 | 64 | 96 (default 64)
    - When size===40 the dimension class is `size-10`; when size===96 it is `size-24`; else `size-16`
    - Fallback initial text: size===40 -> text-sm; size===96 -> text-3xl; else text-xl

    Step B — Create tests/components/profile/FollowerListCard.test.tsx covering:
    1. Renders displayName when present (never with @username alongside)
    2. Renders @username when displayName is null
    3. Renders bio truncated to 1 line via `truncate` class when present; omits the bio element when null
    4. Renders stat strip "N watches · M wishlist"
    5. Whole row is wrapped by a Link to /u/{username}/collection (assert via getByRole('link'))
    6. Inline FollowButton renders with variant='inline' (assert button classList contains `border-border`)
    7. When isOwnRow is true, FollowButton is NOT rendered (queryByRole('button') returns null)
    8. When entry.profilePublic is false (private profile in the list), bio and stat strip are hidden; username+avatar still render
    9. On /followers variant (showFollowedAt=true), renders relative time "N days ago" derived from followedAt
    10. On /following variant (showFollowedAt=false), relative time is NOT rendered
    11. Click on FollowButton does NOT trigger Link navigation — simulate via fireEvent.click on the button and verify a wrapping click listener is not invoked (stopPropagation)
    12. Aria label on Link overlay contains "View {name}'s profile"

    Mock @/app/actions/follows and next/navigation per FollowButton.test.tsx pattern.

    All FollowerListCard tests MUST fail (RED) until Task 2 creates the component. Existing suite (AvatarDisplay callers, FollowButton, LockedProfileState) MUST remain GREEN — the AvatarDisplay size union change is purely additive.
  </behavior>
  <action>
Step A — edit src/components/profile/AvatarDisplay.tsx:
- Change line 8 prop type from `size?: 64 | 96` to `size?: 40 | 64 | 96`
- Change the `dimensionClass` computation (line 23) to: `const dimensionClass = size === 96 ? 'size-24' : size === 40 ? 'size-10' : 'size-16'`
- Change the fallback-initial text-size expression (line 50) to: `size === 96 ? 'text-3xl' : size === 40 ? 'text-sm' : 'text-xl'`
- Preserve everything else including the default of 64

Step B — create tests/components/profile/FollowerListCard.test.tsx.
- Copy the header mocking pattern from tests/components/profile/FollowButton.test.tsx (vi.mock for @/app/actions/follows and for next/navigation useRouter).
- Declare a renderCard helper that renders FollowerListCard with a default props object and allows per-test overrides.
- Describe the expected FollowerListCardProps shape in a JSDoc-adjacent comment so readers know the contract:
    entry: { userId, username, displayName|null, bio|null, avatarUrl|null, profilePublic, watchCount, wishlistCount, followedAt }
    viewerId: string | null
    viewerIsFollowing: boolean
    isOwnRow: boolean
    showFollowedAt: boolean
- For the relative-time test, build an entry with followedAt set to `new Date(Date.now() - 3 * 86_400_000).toISOString()` and assert getByText(/3 days ago/) is present.
- For the private-profile masking test, pass entry.profilePublic=false and assert queryByText(/watches/) returns null and queryByText(/bio/) returns null.
- For the own-row test, pass isOwnRow=true and assert queryByRole('button', { name: /Follow|Unfollow/ }) returns null.
- For the stopPropagation test: place a spy onClick on a parent div wrapping the render output, fireEvent.click on the button, assert the spy was NOT called (because stopPropagation prevented bubbling). Since React Testing Library renders into a real document, use the fact that RTL exposes `render().container.addEventListener` on the outer container.

Commit message: `test(09-03): RED — FollowerListCard (FOLL-04) + AvatarDisplay size=40 extension`.

After writing the test, run:
- Target file RED: `npx vitest run tests/components/profile/FollowerListCard.test.tsx --reporter=dot` must exit non-zero
- Existing suite still GREEN: `npx vitest run --reporter=dot --exclude tests/components/profile/FollowerListCard.test.tsx` must exit 0
  </action>
  <verify>
    <automated>npx vitest run --reporter=dot 2>&1 | tee /tmp/09-03-t1.log; grep -E "FollowerListCard\.test" /tmp/09-03-t1.log | grep -qE "(FAIL|failed)" &amp;&amp; ! grep -E "(AvatarDisplay|LockedProfileState|FollowButton)\.test" /tmp/09-03-t1.log | grep -qE "(FAIL|failed)"</automated>
  </verify>
  <acceptance_criteria>
    - AvatarDisplay size prop union includes 40: grep -cE "size\?:\s*40\s*\|\s*64\s*\|\s*96" src/components/profile/AvatarDisplay.tsx returns at least 1
    - AvatarDisplay maps size=40 to size-10: grep -cE "size === 40.*size-10|size-10.*40" src/components/profile/AvatarDisplay.tsx returns at least 1
    - AvatarDisplay maps size=40 to text-sm initial: grep -cE "size === 40.*text-sm|text-sm.*40" src/components/profile/AvatarDisplay.tsx returns at least 1
    - tests/components/profile/FollowerListCard.test.tsx exists: test -f tests/components/profile/FollowerListCard.test.tsx succeeds
    - Contains at least 10 test cases: grep -cE "it\(|test\(" tests/components/profile/FollowerListCard.test.tsx returns >= 10
    - Tests private-profile masking: grep -ciE "profilePublic:\s*false|private.*profile" tests/components/profile/FollowerListCard.test.tsx returns >= 1
    - Tests own-row hidden button: grep -cE "isOwnRow" tests/components/profile/FollowerListCard.test.tsx returns >= 1
    - Tests Link href to /u/{username}/collection: grep -cE "/u/.+/collection" tests/components/profile/FollowerListCard.test.tsx returns >= 1
    - Tests relative time rendering with days-ago fixture: grep -cE "days ago|showFollowedAt" tests/components/profile/FollowerListCard.test.tsx returns >= 1
    - FollowerListCard test file in RED state (target test failing); existing AvatarDisplay/LockedProfileState/FollowButton tests still passing
    - TypeScript strict clean on AvatarDisplay: npx tsc --noEmit output contains zero lines mentioning AvatarDisplay.tsx
  </acceptance_criteria>
  <done>AvatarDisplay accepts size=40 and retains prior sizes; FollowerListCard test file exists with 10+ test cases in RED state; existing test suite remains GREEN; commit landed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement FollowerListCard + FollowerList components (GREEN)</name>
  <files>src/components/profile/FollowerListCard.tsx, src/components/profile/FollowerList.tsx</files>
  <read_first>
    - src/components/profile/FollowerListCard.tsx (verify does NOT yet exist)
    - src/components/profile/FollowerList.tsx (verify does NOT yet exist)
    - src/components/profile/FollowButton.tsx (Plan 02 — inline variant signature)
    - src/components/profile/AvatarDisplay.tsx (Task 1 extension — size=40 available)
    - src/lib/utils.ts (cn helper)
    - .planning/phases/09-follow-system-collector-profiles/09-UI-SPEC.md (Follower list page layout section — exact row structure, spacing, copy, divider)
    - .planning/phases/09-follow-system-collector-profiles/09-RESEARCH.md (Pattern 6 lines ~398-440 — sample FollowRow reference)
    - tests/components/profile/FollowerListCard.test.tsx (Task 1 — all assertions must pass)
  </read_first>
  <action>
Create src/components/profile/FollowerListCard.tsx — Client Component.
Use `'use client'` as the first line.
- Imports: Link from 'next/link', AvatarDisplay from './AvatarDisplay', FollowButton from './FollowButton'
- Exported interface FollowerListCardProps with the shape documented in the interfaces block above
- Private helper `relativeTime(isoDate: string): string` that returns:
    * 'today' when diff < 1 day
    * '1 day ago' when diff is exactly 1 day
    * `${n} days ago` when diff < 30 days
    * '1 month ago' / `${n} months ago` for longer spans
- Render shape (matches UI-SPEC):
    Outer div: classes `relative flex items-center gap-4 border-b border-border py-4 hover:bg-muted/40 transition-colors`
    Inside, render a next/link `<Link>` with href=`/u/${entry.username}/collection`, aria-label=`View ${primaryLabel}'s profile`, className=`absolute inset-0 z-0` — creates the clickable overlay
    Avatar block: wrap AvatarDisplay in a div with classes `relative z-10 pointer-events-none` and pass size=40
    Text block: div with classes `relative z-10 flex-1 min-w-0 pointer-events-none`
        p1 primaryLabel: `text-sm font-semibold text-foreground truncate`
        if showBioAndStats && entry.bio -> p2 bio: `text-xs text-muted-foreground truncate`
        if showBioAndStats -> p3 stat strip: `text-xs text-muted-foreground` content "N watches · M wishlist" plus optional " · ${relativeTime(entry.followedAt)}" when showFollowedAt true
    Follow action block (only when !isOwnRow):
        wrapper div: classes `relative z-10 pointer-events-auto`
        onClick handler: (e) => e.stopPropagation()
        onKeyDown handler: (e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }
        FollowButton viewerId={viewerId} targetUserId={entry.userId} targetDisplayName={primaryLabel} initialIsFollowing={viewerIsFollowing} variant="inline"
- Derived values:
    primaryLabel = entry.displayName ?? `@${entry.username}`
    showBioAndStats = entry.profilePublic === true

Create src/components/profile/FollowerList.tsx — Server Component (no 'use client').
- Imports: FollowerListCard from './FollowerListCard', type FollowerListEntry from '@/data/follows'
- Exported interface FollowerListProps: entries (FollowerListEntry array), viewerFollowingSet (Set of userIds the viewer already follows), viewerId (string or null), emptyCopy (string), showFollowedAt (boolean)
- Render:
    If entries.length === 0, render an empty-state card: section with classes `flex flex-col items-center justify-center rounded-xl border bg-card py-12 text-center` containing a single p with classes `text-sm text-muted-foreground` and text = emptyCopy
    Otherwise render a ul (no extra classes needed) and for each entry emit an li containing FollowerListCard with:
        entry=entry
        viewerId=viewerId
        viewerIsFollowing=viewerFollowingSet.has(entry.userId)
        isOwnRow=(viewerId !== null && viewerId === entry.userId)
        showFollowedAt=showFollowedAt

After writing both components:
- Run the Task 1 test file: npx vitest run tests/components/profile/FollowerListCard.test.tsx --reporter=dot — must go GREEN
- Run the full suite: npx vitest run --reporter=dot — still green
- npx tsc --noEmit — must be clean

Commit message: feat(09-03): FollowerListCard + FollowerList components (FOLL-04)
  </action>
  <verify>
    <automated>npx vitest run --reporter=dot 2>&1 | tee /tmp/09-03-t2.log; grep -qE "Test Files .*passed" /tmp/09-03-t2.log &amp;&amp; grep -qE "0 failed" /tmp/09-03-t2.log &amp;&amp; npx tsc --noEmit 2>&1 | grep -E "(FollowerListCard|FollowerList)\.tsx" | wc -l | grep -q "^0$"</automated>
  </verify>
  <acceptance_criteria>
    - src/components/profile/FollowerListCard.tsx exists with 'use client' on line 1: head -1 src/components/profile/FollowerListCard.tsx contains 'use client'
    - Imports FollowButton from ./FollowButton and AvatarDisplay from ./AvatarDisplay and Link from next/link: grep -cE "from './FollowButton'|from './AvatarDisplay'|from 'next/link'" src/components/profile/FollowerListCard.tsx >= 3
    - Passes variant="inline" to FollowButton: grep -c "variant=\"inline\"" src/components/profile/FollowerListCard.tsx >= 1
    - Renders Link overlay with absolute inset-0: grep -c "absolute inset-0" src/components/profile/FollowerListCard.tsx >= 1
    - href points to /collection: grep -cE "href=\\{`/u/\\$\\{entry.username\\}/collection`\\}|/u/.*/collection" src/components/profile/FollowerListCard.tsx >= 1
    - aria-label on Link contains "View": grep -c "View \\$\\{primaryLabel\\}'s profile\\|aria-label" src/components/profile/FollowerListCard.tsx >= 1
    - stopPropagation present on Follow wrapper: grep -c "stopPropagation" src/components/profile/FollowerListCard.tsx >= 1
    - Hides Follow when isOwnRow true: grep -cE "!isOwnRow" src/components/profile/FollowerListCard.tsx >= 1
    - Private-profile masking: reference to entry.profilePublic gating bio/stats: grep -cE "(profilePublic|showBioAndStats)" src/components/profile/FollowerListCard.tsx >= 2
    - AvatarDisplay size=40: grep -c "size={40}" src/components/profile/FollowerListCard.tsx >= 1
    - src/components/profile/FollowerList.tsx exists and does NOT declare 'use client': ! grep -q "'use client'" src/components/profile/FollowerList.tsx
    - Renders empty-state card with py-12 treatment when entries length is 0: grep -cE "py-12|bg-card" src/components/profile/FollowerList.tsx >= 2
    - Passes viewerIsFollowing via Set.has: grep -c "viewerFollowingSet.has" src/components/profile/FollowerList.tsx >= 1
    - All Task 1 RTL tests pass: npx vitest run tests/components/profile/FollowerListCard.test.tsx --reporter=dot exits 0
    - Full test suite green: npx vitest run --reporter=dot exits 0
    - TypeScript strict clean: npx tsc --noEmit output contains zero lines for FollowerListCard.tsx or FollowerList.tsx
  </acceptance_criteria>
  <done>Both components exist, pass all RTL tests, TypeScript strict clean, UI-SPEC classes match contract, commit landed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create /u/[username]/followers and /u/[username]/following route pages with heading, subheading, and empty-state copy</name>
  <files>src/app/u/[username]/followers/page.tsx, src/app/u/[username]/following/page.tsx</files>
  <read_first>
    - src/app/u/[username]/layout.tsx (outer layout — these pages are siblings to the [tab] route and nest inside this layout)
    - src/app/u/[username]/[tab]/page.tsx (async params precedent — lines 33-40; viewer resolution with UnauthorizedError catch — lines 44-50)
    - src/data/follows.ts (Plan 01 — getFollowersForProfile, getFollowingForProfile, isFollowing)
    - src/data/profiles.ts (getProfileByUsername)
    - src/lib/auth.ts (getCurrentUser, UnauthorizedError)
    - src/components/profile/FollowerList.tsx (Task 2 — FollowerList consumer)
    - .planning/phases/09-follow-system-collector-profiles/09-UI-SPEC.md (Follower / following list page layout — heading, subheading, page padding)
    - .planning/phases/09-follow-system-collector-profiles/09-CONTEXT.md (D-11, D-13, D-14; also note the layout wraps both pages via src/app/u/[username]/layout.tsx which already renders ProfileHeader + ProfileTabs + children — the followers/following pages render inside {children})
  </read_first>
  <action>
CRITICAL: the outer layout at src/app/u/[username]/layout.tsx wraps EVERYTHING under /u/[username]/* — including /followers and /following. That means ProfileHeader and ProfileTabs will appear above the list content on these pages. That matches UI-SPEC (followers page has profile header context).

Create src/app/u/[username]/followers/page.tsx:

- Header shape (copy paste this structure, adjust for page-specific heading):
    import { notFound } from 'next/navigation'
    import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
    import { getProfileByUsername } from '@/data/profiles'
    import { getFollowersForProfile, isFollowing } from '@/data/follows'
    import { FollowerList } from '@/components/profile/FollowerList'
- Default exported async function FollowersPage with params typed as Promise of { username: string }
- Flow:
    1. const { username } = await params
    2. const profile = await getProfileByUsername(username); if (!profile) notFound()
    3. Resolve viewerId with try/catch around getCurrentUser() (same pattern as [tab]/page.tsx line 45-50)
    4. const isOwner = viewerId === profile.id
    5. const entries = await getFollowersForProfile(profile.id)
    6. Compute the viewerFollowingSet — per-row isFollowing hydration. If viewerId is null, set is empty. Otherwise, batch:
        const viewerFollowingSet: Set<string> = new Set()
        if (viewerId) {
          const results = await Promise.all(entries.map((e) => isFollowing(viewerId, e.userId)))
          entries.forEach((e, i) => { if (results[i]) viewerFollowingSet.add(e.userId) })
        }
    7. Compute primaryLabel = profile.displayName ?? `@${profile.username}`
    8. Compute emptyCopy per UI-SPEC:
        if (entries.length === 0 && isOwner) emptyCopy = 'You dont have any followers yet.'
        else if (entries.length === 0) emptyCopy = 'No followers yet.'
    9. Render page:
        a div wrapper (no outer layout wrapper needed — layout.tsx already provides mx-auto max-w-5xl):
        <div>
          <header className="pt-8 pb-4">
            <h1 className="text-xl font-semibold">Followers</h1>
            <p className="text-sm text-muted-foreground">{primaryLabel}&apos;s followers</p>
          </header>
          <FollowerList
            entries={entries}
            viewerFollowingSet={viewerFollowingSet}
            viewerId={viewerId}
            emptyCopy={emptyCopy}
            showFollowedAt={true}
          />
        </div>

Create src/app/u/[username]/following/page.tsx with the mirror shape. Differences:
- Imports getFollowingForProfile instead of getFollowersForProfile
- Subheading text: `${primaryLabel} is following`
- Heading: "Following"
- Empty copy:
    if (entries.length === 0 && isOwner) emptyCopy = 'You arent following anyone yet.'
    else if (entries.length === 0) emptyCopy = `${primaryLabel} isnt following anyone yet.`
- showFollowedAt=false

Manual smoke verification (document in commit body, not automated — human UAT):
- npm run dev; visit /u/{existingUser}/followers — renders header "Followers"
- Visit /u/{existingUser}/following — renders header "Following"
- Visit /u/nonexistent/followers — returns Next.js 404 page
- Click a row — navigates to /u/{other}/collection
- Click the inline Follow button on a row — does not navigate, toggles state

Commit message: feat(09-03): follower and following list routes (FOLL-04)
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "(followers|following)/page\.tsx" | wc -l | grep -q "^0$" &amp;&amp; npx vitest run --reporter=dot 2>&1 | grep -qE "0 failed" &amp;&amp; npx eslint src/app/u/\[username\]/followers/page.tsx src/app/u/\[username\]/following/page.tsx 2>&1 | (! grep -qE "(error|Error)")</automated>
  </verify>
  <acceptance_criteria>
    - File src/app/u/[username]/followers/page.tsx exists: test -f src/app/u/[username]/followers/page.tsx succeeds
    - File src/app/u/[username]/following/page.tsx exists: test -f src/app/u/[username]/following/page.tsx succeeds
    - Both pages use async params (Next.js 16 pattern): grep -cE "await params" src/app/u/\[username\]/followers/page.tsx src/app/u/\[username\]/following/page.tsx >= 2
    - followers/page.tsx imports getFollowersForProfile and isFollowing: grep -c "getFollowersForProfile" src/app/u/\[username\]/followers/page.tsx >= 1 AND grep -c "isFollowing" src/app/u/\[username\]/followers/page.tsx >= 1
    - following/page.tsx imports getFollowingForProfile: grep -c "getFollowingForProfile" src/app/u/\[username\]/following/page.tsx >= 1
    - Both pages notFound() on missing profile: grep -c "notFound()" src/app/u/\[username\]/followers/page.tsx >= 1 AND grep -c "notFound()" src/app/u/\[username\]/following/page.tsx >= 1
    - Both pages render FollowerList: grep -c "<FollowerList" src/app/u/\[username\]/followers/page.tsx >= 1 AND grep -c "<FollowerList" src/app/u/\[username\]/following/page.tsx >= 1
    - followers page heading exact copy: grep -c ">Followers<" src/app/u/\[username\]/followers/page.tsx >= 1
    - following page heading exact copy: grep -c ">Following<" src/app/u/\[username\]/following/page.tsx >= 1
    - followers subheading uses "'s followers": grep -cE "'s followers|&apos;s followers" src/app/u/\[username\]/followers/page.tsx >= 1
    - following subheading uses "is following": grep -c "is following" src/app/u/\[username\]/following/page.tsx >= 1
    - followers page empty copy "No followers yet." present: grep -c "No followers yet" src/app/u/\[username\]/followers/page.tsx >= 1
    - following page empty copy mirror present: grep -cE "isnt following anyone yet" src/app/u/\[username\]/following/page.tsx >= 1
    - owner-side empty copy present on both: grep -cE "You dont have any followers yet" src/app/u/\[username\]/followers/page.tsx >= 1 AND grep -cE "You arent following anyone yet" src/app/u/\[username\]/following/page.tsx >= 1
    - showFollowedAt=true on /followers and =false on /following: grep -c "showFollowedAt={true}" src/app/u/\[username\]/followers/page.tsx >= 1 AND grep -c "showFollowedAt={false}" src/app/u/\[username\]/following/page.tsx >= 1
    - viewerFollowingSet hydrated from batched isFollowing calls: grep -cE "Promise.all.*isFollowing|isFollowing.*Promise.all" src/app/u/\[username\]/followers/page.tsx >= 1
    - TypeScript strict clean on both page files: npx tsc --noEmit output contains no (followers|following)/page\.tsx lines
    - Full suite green: npx vitest run --reporter=dot exits 0
    - ESLint clean on both page files: npx eslint on the two files reports no error-level issues
  </acceptance_criteria>
  <done>Two route pages ship, each resolves owner profile, returns 404 on missing username, fetches list via Plan 01 DAL, hydrates viewerFollowingSet for per-row initial state, renders heading/subheading/FollowerList/empty-state per UI-SPEC, TypeScript strict clean, ESLint clean, full suite green, commit landed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client row-click → Next.js Link navigation | Link href is server-rendered from DAL output (entry.username) — server-side data, not user input beyond URL segment |
| Client inline FollowButton click → Server Action | Same as Plan 02; stopPropagation prevents double-firing with the Link overlay |
| Server page → DAL | getFollowersForProfile / getFollowingForProfile service-role bypass RLS; DAL receives owner userId as function arg, no trust of auth.uid() inside SQL |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-15 | Information Disclosure | Private-profile usernames exposed in public follow lists | mitigate | DAL exposes username and avatar (per D-21 graph is public) but the UI-level FollowerListCard hides bio/stats when `entry.profilePublic === false`. Link overlay still routes to /u/{username}/collection which will hit the Phase 8 LockedProfileState for private users (already enforced). |
| T-09-16 | Information Disclosure | Existence of a missing username leaked via different response | mitigate | Pages use `notFound()` (Next.js 404) on missing profile — identical response to any other missing resource; carries forward Phase 8 Letterboxd pattern. |
| T-09-17 | Tampering | Row click triggers Follow action race | mitigate | stopPropagation on Follow wrapper; Plan 02 `disabled={pending}` on FollowButton prevents double-fires. |
| T-09-18 | DoS | Profile with 10,000 followers produces a huge page | accept | Target scale is <500 users per CLAUDE.md; D-13 locks "no pagination at MVP". Keyset pagination swap-in documented as deferred. |
| T-09-19 | Information Disclosure | isFollowing batch on /followers page discloses viewer's following list to themselves (self-known fact) | accept | Viewer already knows their own following relationships; no foreign data leak. |
| T-09-20 | Information Disclosure | Follower list enumerates every user (scraping) | accept | Graph is public by product design (D-21); usernames+avatars only without bio/stats for private profiles. Rate limiting is out of scope. |
</threat_model>

<verification>
1. `npx vitest run --reporter=dot` exits 0.
2. `npx tsc --noEmit` exits 0 — verify with grep zero lines touching the three new files.
3. `npx eslint src/app/u/\[username\]/followers/page.tsx src/app/u/\[username\]/following/page.tsx src/components/profile/FollowerListCard.tsx src/components/profile/FollowerList.tsx` reports no errors.
4. Full suite continues to pass — no regression in Phase 8's ProfileHeader/LockedProfileState tests (those were updated in Plan 02).
5. Manual smoke (human UAT, not automated): `npm run dev`; hit /u/{user}/followers and /u/{user}/following; toggle inline Follow buttons; verify clicks on the row body navigate to /u/{other}/collection but clicks on the button do not.
6. Privacy sanity: create a private-profile test user (profile_public=false) and verify their row in a follower list does NOT show their bio or watch counts.
</verification>

<success_criteria>
- /u/[username]/followers and /u/[username]/following both resolve via server-rendered Server Components.
- Missing username returns Next.js 404 via notFound() — same surface as missing profile in Phase 8.
- Each page renders heading + subheading + FollowerList + empty state per UI-SPEC copywriting contract.
- Lists order by follows.created_at DESC (Plan 01 DAL); no pagination at MVP.
- FollowerListCard shows avatar + displayName or @username + bio (when public) + watch/wishlist stats (when public).
- Rows are clickable as whole — Link overlay with pointer-events-none on inner content routes to /u/{other}/collection (D-14 explicit default-tab link).
- Inline FollowButton on each row (except viewer's own row) with outline variant; stopPropagation prevents the row Link from firing.
- Private-profile entries in the list show username + avatar but NOT bio or stat strip (T-09-15 mitigation).
- Each row FollowButton receives initialIsFollowing hydrated via Promise.all batch of isFollowing(viewerId, entry.userId) — no N+1 (single round trip per entry, parallelized).
- AvatarDisplay extended to accept size=40 for list row avatars per UI-SPEC.
- All three new component/page files are TypeScript strict clean.
- Wave 0 tests for FollowerListCard cover row structure, private masking, own-row hide, relative-time rendering, stopPropagation semantics, and empty state.
</success_criteria>

<output>
After completion create .planning/phases/09-follow-system-collector-profiles/09-03-SUMMARY.md with:
- Files created (two route pages, three components, one test file)
- AvatarDisplay extension rationale and impact
- DAL functions consumed and in what quantity per page render
- Test count and green status
- Any UI-SPEC divergences (should be none)
</output>
