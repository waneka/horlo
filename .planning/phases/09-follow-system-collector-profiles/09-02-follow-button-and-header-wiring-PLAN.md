---
phase: 09-follow-system-collector-profiles
plan: 02
type: execute
wave: 2
depends_on: [09-01-data-actions-taste-overlap-PLAN]
files_modified:
  - src/components/profile/FollowButton.tsx
  - src/components/profile/ProfileHeader.tsx
  - src/components/profile/LockedProfileState.tsx
  - src/app/u/[username]/layout.tsx
  - tests/components/profile/FollowButton.test.tsx
  - tests/components/profile/LockedProfileState.test.tsx
autonomous: true
requirements: [FOLL-01, FOLL-02, FOLL-03, PROF-08]
must_haves:
  truths:
    - "ProfileHeader on a non-owner view renders a 'Follow' button in the not-following state (bg-accent text-accent-foreground)"
    - "ProfileHeader on a non-owner view when viewer already follows owner renders 'Following' in muted style"
    - "Hovering or focusing the 'Following' button flips the visible text to 'Unfollow' in destructive color (desktop hover-swap per D-09)"
    - "Clicking Follow increments followerCount by 1 optimistically before the Server Action returns (D-06)"
    - "On Server Action error, local state rolls back and count decrements back (D-06 rollback branch)"
    - "LockedProfileState's Follow button is now a live FollowButton — clicking writes a follow row even though content stays locked (D-08 auto-accept)"
    - "Owner viewing their own profile sees NO FollowButton (disabled-self case hidden entirely, no render)"
    - "Unauthenticated viewer clicking Follow navigates to /login?next=/u/{username} (no Server Action fires) — /login route exists at src/app/login/page.tsx (verified in repo)"
    - "layout.tsx fetches isFollowing(viewerId, profile.id) and passes it to ProfileHeader + LockedProfileState"
    - "After a successful follow, `router.refresh()` re-reads layout which re-fetches getFollowerCounts → displayed count matches server count within one refresh cycle (Success Criterion #5)"
  artifacts:
    - path: "src/components/profile/FollowButton.tsx"
      provides: "Client Component with useState + useTransition + router.refresh() per D-06; three variants: primary, locked, inline"
      exports: ["FollowButton"]
    - path: "src/components/profile/ProfileHeader.tsx"
      provides: "Extended to accept viewerId + initialIsFollowing + targetUserId props; renders FollowButton when !isOwner"
    - path: "src/components/profile/LockedProfileState.tsx"
      provides: "Replaces disabled Follow placeholder with live FollowButton (locked variant)"
    - path: "src/app/u/[username]/layout.tsx"
      provides: "Fetches isFollowing when viewer && !isOwner; passes viewerId + initialIsFollowing to ProfileHeader and LockedProfileState"
    - path: "tests/components/profile/FollowButton.test.tsx"
      provides: "RTL tests for all button states, optimistic updates, rollback on error, variant props"
      contains: "describe('FollowButton'"
  key_links:
    - from: "src/components/profile/FollowButton.tsx"
      to: "src/app/actions/follows.ts"
      via: "direct import of followUser, unfollowUser Server Actions"
      pattern: "from '@/app/actions/follows'"
    - from: "src/components/profile/FollowButton.tsx"
      to: "next/navigation useRouter().refresh()"
      via: "router.refresh() after awaited action resolves"
      pattern: "router\\.refresh\\(\\)"
    - from: "src/components/profile/FollowButton.tsx"
      to: "src/app/login/page.tsx"
      via: "unauth click path — router.push('/login?next=' + encodeURIComponent(pathname))"
      pattern: "/login\\?next="
    - from: "src/app/u/[username]/layout.tsx"
      to: "src/data/follows.ts::isFollowing"
      via: "server-side fetch when viewer is authenticated and !isOwner"
      pattern: "isFollowing\\(viewerId"
    - from: "src/components/profile/ProfileHeader.tsx"
      to: "src/components/profile/FollowButton.tsx"
      via: "renders primary variant when !isOwner"
      pattern: "<FollowButton"
    - from: "src/components/profile/LockedProfileState.tsx"
      to: "src/components/profile/FollowButton.tsx"
      via: "renders locked variant inside the private-profile card"
      pattern: "<FollowButton"
---

<objective>
Wire the follow action into the existing profile surfaces:
1. Create `FollowButton.tsx` Client Component with three visual variants (primary, locked, inline) per UI-SPEC Interaction Contracts section. Implements D-06 optimistic updates, D-09 hover-swap + mobile two-tap, D-10 self-hidden on own profile, and unauth → `/login?next=/u/[username]` redirect (login route verified to exist at `src/app/login/page.tsx`).
2. Extend ProfileHeader to accept viewer context (`viewerId`, `targetUserId`, `initialIsFollowing`) and render the primary FollowButton variant when `!isOwner`.
3. Wire LockedProfileState's existing (disabled) Follow placeholder to a live FollowButton (locked variant).
4. Extend `src/app/u/[username]/layout.tsx` to fetch `isFollowing(viewerId, profile.id)` server-side when a viewer is authenticated and not the owner, and propagate the value to both ProfileHeader and LockedProfileState.

Purpose: Satisfies FOLL-01/02/03 end-to-end and preserves PROF-08 (non-owner read-only view). The follower count on ProfileHeader reconciles from server every time via `router.refresh()` — no denormalized count (D-22).

Output: New FollowButton component, extended ProfileHeader/LockedProfileState/layout.tsx, and RTL test coverage over every button state and optimistic path.
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
@CLAUDE.md
@AGENTS.md

<interfaces>
<!-- Plan 01 exports (use these directly, do NOT re-explore) -->
From src/app/actions/follows.ts (created in Plan 01):
```typescript
export async function followUser(data: unknown): Promise<ActionResult<void>>
export async function unfollowUser(data: unknown): Promise<ActionResult<void>>
// Both accept { userId: string (uuid) } via Zod .strict()
```

From src/data/follows.ts (created in Plan 01):
```typescript
export async function isFollowing(followerId: string, followingId: string): Promise<boolean>
```

From src/lib/actionTypes.ts:
```typescript
export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }
```

Existing components (extend these in this plan):

src/components/profile/ProfileHeader.tsx (current shape):
```typescript
interface ProfileHeaderProps {
  username: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  isOwner: boolean
  followerCount: number
  followingCount: number
  watchCount: number
  wishlistCount: number
  tasteTags: string[]
}
// Renders an Edit Profile button (owner only). Must ADD: FollowButton (non-owner only).
// 'use client' already declared on this file.
```

src/components/profile/LockedProfileState.tsx (current shape):
```typescript
interface LockedProfileStateProps {
  username: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  followerCount: number
  followingCount: number
}
// Currently renders `<Button disabled aria-label="Follow (coming soon)">Follow</Button>`
// — REPLACE with live <FollowButton variant="locked" ... />
// This file is a Server Component (no 'use client' directive) — it imports the client-side
// FollowButton, which is fine (Server→Client boundary is allowed).
```

src/app/u/[username]/layout.tsx (current flow, lines 15-107):
- Awaits params → username
- Resolves viewerId via getCurrentUser (catches UnauthorizedError → null)
- Awaits getProfileByUsername(username) → notFound() if null
- Sets isOwner = viewerId === profile.id
- Awaits getProfileSettings(profile.id)
- If !isOwner && !settings.profilePublic → renders LockedProfileState
- Otherwise: Promise.all([getFollowerCounts, getWatchesByUser, getAllWearEventsByUser]) → computes tasteTags → renders ProfileHeader + ProfileTabs + children

NEW DAL CALL TO ADD: when `viewerId && !isOwner`, call `isFollowing(viewerId, profile.id)` and pass result to ProfileHeader (primary path) and LockedProfileState (locked path).

Reusable UI primitives (already present):
- `Button` from `@/components/ui/button` (shadcn, uses base-ui under the hood)
- `useRouter` from `next/navigation` (App Router API — NOT `next/router`)
- `useTransition`, `useState` from `react`

Verified in repo (ls confirmed before planning):
- `src/app/login/page.tsx` exists — the unauth `/login?next=...` redirect target is real. Login handler's handling of the `next` query parameter is carry-forward behavior from prior phases; Phase 9 only originates the redirect with a `pathname`-derived (same-origin) value, so no new exposure.
- `src/app/signup/page.tsx` also exists (adjacent auth surface; not used by Phase 9).
- `src/app/forgot-password/page.tsx` and `src/app/reset-password/page.tsx` exist (adjacent; not used by Phase 9).

UI-SPEC locked values (from 09-UI-SPEC.md Interaction Contracts):
- Follow button primary variant: `bg-accent text-accent-foreground` (not-following); `bg-muted text-muted-foreground` (following rest); `bg-muted text-destructive` (unfollow hover/focus/tap-revealed)
- Primary variant size: text-sm font-semibold, height 32px desktop
- Locked variant: identical visual to primary (accent fill), placed below "This profile is private." copy
- Inline variant (for Plan 03 consumption): `border border-border text-foreground`, height 32px desktop / 40px mobile, NO accent fill
- Hover-swap pattern: `<span className="group-hover:hidden group-focus:hidden">Following</span><span className="hidden group-hover:inline group-focus:inline">Unfollow</span>` inside a button with `className="group bg-muted text-muted-foreground hover:text-destructive focus:text-destructive"`
- Mobile two-tap: first tap reveals "Unfollow" via local `revealed` state; second tap commits the unfollow
- aria-pressed reflects isFollowing; aria-label uses "Follow {displayName ?? username}" / "Unfollow {displayName ?? username}"
- aria-busy="true" while the useTransition is pending
- Error toast copy: "Couldn't follow. Try again." / "Couldn't unfollow. Try again." / "You can't follow yourself."
- Unauth click: `router.push('/login?next=/u/{username}')` — no Server Action fires
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Wave 0 — RTL tests for FollowButton (all states, optimistic path, rollback)</name>
  <files>tests/components/profile/FollowButton.test.tsx</files>
  <read_first>
    - tests/components/profile/LockedProfileState.test.tsx (RTL precedent with @testing-library/react)
    - tests/setup.ts (globals and matchers)
    - .planning/phases/09-follow-system-collector-profiles/09-UI-SPEC.md (Interaction Contracts section — follow-button primary/locked/inline variants, states table, copy)
    - .planning/phases/09-follow-system-collector-profiles/09-VALIDATION.md (test map — FOLL-01 optimistic, FOLL-02 rollback)
    - .planning/phases/09-follow-system-collector-profiles/09-01-SUMMARY.md (Plan 01 API signatures)
    - vitest.config.ts (jsdom environment)
  </read_first>
  <behavior>
    tests/components/profile/FollowButton.test.tsx covers FOLL-01, FOLL-02, FOLL-03 at the component boundary.

    Mock `@/app/actions/follows` for the whole suite — `followUser` and `unfollowUser` return configurable ActionResult. Mock `next/navigation`'s useRouter (return `{ refresh: vi.fn(), push: vi.fn() }`).

    Primary variant tests:
    1. Renders "Follow" label when `initialIsFollowing=false` — label is exactly the string "Follow"
    2. Renders "Following" label when `initialIsFollowing=true`
    3. `aria-pressed="false"` when not following; `aria-pressed="true"` when following
    4. `aria-label` is "Follow Tyler" when `targetDisplayName='Tyler'`, `initialIsFollowing=false`
    5. `aria-label` is "Unfollow Tyler" when `initialIsFollowing=true`
    6. Click when not-following calls `followUser({ userId: 'target-id' })` (verify via mock spy)
    7. Click when not-following bumps the LOCAL followerCount display by 1 before the mocked action resolves (test via rendering a count-display child OR through the button's visible text if we include count there)

    Optimistic + rollback tests (central to D-06):
    8. Given followUser mock resolves `{ success: true }`: after click, isFollowing flips to true, router.refresh() is called once
    9. Given followUser mock resolves `{ success: false, error: 'boom' }`: after click, isFollowing stays false (rollback), followerCount reverts
    10. During `pending`, the button is visually disabled-feeling: has `aria-busy="true"` (via `screen.getByRole('button').getAttribute('aria-busy')`)

    Hover-swap tests:
    11. When `initialIsFollowing=true` and the user hovers (fireEvent.mouseEnter) the button, the visible text becomes "Unfollow" — but note that the UI-SPEC uses CSS group-hover which jsdom does NOT apply. Instead, test the DOM structure: `expect(button).toContainHTML('Following')` AND `expect(button).toContainHTML('Unfollow')` (both rendered, CSS controls which is visible). Assert both spans exist via `queryAllByText`.

    Mobile two-tap tests:
    12. When `initialIsFollowing=true`: first click ONLY reveals the "Unfollow" tap-state (sets local `revealed=true`, does not call unfollowUser). Verify: after first click `unfollowUser` mock is NOT called. After second click within 3s, `unfollowUser` IS called.
    13. If first click sets revealed=true and user presses Escape or blurs, revealed resets to false (optional — implement if time permits; can be a todo in the test).

    Variant tests:
    14. `variant="inline"` renders `border border-border text-foreground` (use `toHaveClass` on the button)
    15. `variant="primary"` renders `bg-accent text-accent-foreground` when not-following
    16. `variant="locked"` has identical class set to primary (both are solid accent fill)

    Self-guard / unauth tests:
    17. When `viewerId === targetUserId`: the FollowButton renders `null` (hidden entirely on own row, D-07/D-12)
    18. When `viewerId === null` (unauth): click does NOT call followUser; instead router.push('/login?next=/u/tyler') is called once

    Write every test with `beforeEach(() => vi.clearAllMocks())`. Every test MUST fail on first run (RED — FollowButton.tsx does not exist yet).
  </behavior>
  <action>
Create `tests/components/profile/FollowButton.test.tsx` using `@testing-library/react` + `vitest`. Import `render`, `screen`, `fireEvent`. 

Mock `@/app/actions/follows`:
```typescript
vi.mock('@/app/actions/follows', () => ({
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
}))
```

Mock `next/navigation`:
```typescript
const mockRefresh = vi.fn()
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh, push: mockPush }),
}))
```

Declare a `renderButton(props?)` helper that returns `render(<FollowButton {...defaults} {...props} />)`.

Write tests in `describe('FollowButton — primary variant', ...)`, `describe('FollowButton — optimistic + rollback', ...)`, `describe('FollowButton — hover-swap DOM structure', ...)`, `describe('FollowButton — mobile two-tap', ...)`, `describe('FollowButton — variants', ...)`, `describe('FollowButton — self guard + unauth', ...)`.

Commit message: `test(09-02): RED — FollowButton state, optimistic, rollback, variants`.

After writing, run `npx vitest run tests/components/profile/FollowButton.test.tsx --reporter=dot` — all tests should fail with "Cannot find module '@/components/profile/FollowButton'" (RED state).
  </action>
  <verify>
    <automated>npx vitest run tests/components/profile/FollowButton.test.tsx --reporter=dot 2>&1 | tee /tmp/09-02-t1.log; grep -qE "(FAIL|failed)" /tmp/09-02-t1.log</automated>
  </verify>
  <acceptance_criteria>
    - File `tests/components/profile/FollowButton.test.tsx` exists: `test -f tests/components/profile/FollowButton.test.tsx`
    - Contains `describe('FollowButton` at least 5 times (suite groups): `grep -c "describe('FollowButton" tests/components/profile/FollowButton.test.tsx >= 5`
    - Mocks `@/app/actions/follows`: `grep -c "vi.mock('@/app/actions/follows'" tests/components/profile/FollowButton.test.tsx >= 1`
    - Mocks `next/navigation` useRouter with refresh + push: `grep -cE "(useRouter|refresh|push)" tests/components/profile/FollowButton.test.tsx >= 3`
    - Tests exact aria-label copy: `grep -c "Follow Tyler\\|Unfollow Tyler" tests/components/profile/FollowButton.test.tsx >= 2`
    - Tests self-hidden (viewerId === targetUserId → null render): `grep -ciE "(self|own row|viewerId.*targetUserId)" tests/components/profile/FollowButton.test.tsx >= 1`
    - Tests unauth redirect to /login?next=: `grep -c "/login?next=" tests/components/profile/FollowButton.test.tsx >= 1`
    - Tests optimistic rollback (error branch): `grep -ciE "(rollback|success: false)" tests/components/profile/FollowButton.test.tsx >= 1`
    - Running the test file exits non-zero (RED): `npx vitest run tests/components/profile/FollowButton.test.tsx --reporter=dot; echo $?` returns non-zero
  </acceptance_criteria>
  <done>RTL test file exists with 15+ test cases covering every state/variant/edge from UI-SPEC; running the test file fails (RED because FollowButton.tsx is not yet created); committed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement FollowButton.tsx (GREEN) — three variants, optimistic + rollback + hover-swap + mobile two-tap + unauth redirect</name>
  <files>src/components/profile/FollowButton.tsx</files>
  <read_first>
    - src/components/profile/FollowButton.tsx (verify does NOT yet exist)
    - src/app/login/page.tsx (VERIFIED to exist at this path — ls confirmed during planning. The unauth redirect target in this task is grounded in repo state, not speculation. Plan 02 uses `/login?next={encodeURIComponent(pathname)}`. Same-origin pathname only; off-origin absolute URLs are not produced by this component.)
    - src/components/ui/button.tsx (existing Button primitive — compose its className via cn)
    - src/components/profile/NoteVisibilityPill.tsx (useOptimistic + useTransition pattern; Phase 9 uses useState+useTransition per D-06)
    - src/components/profile/ProfileEditForm.tsx (useState + useTransition + router.refresh precedent)
    - src/components/watch/WatchDetail.tsx (router.refresh() pattern after await mutation)
    - src/lib/utils.ts (cn helper for conditional classes)
    - .planning/phases/09-follow-system-collector-profiles/09-UI-SPEC.md (Interaction Contracts — primary / locked / inline variants, states table, hover-swap implementation tsx snippet lines ~420-430 in UI-SPEC, aria attributes)
    - .planning/phases/09-follow-system-collector-profiles/09-RESEARCH.md (Pattern 2 lines ~210-260 for full FollowButton reference implementation)
    - tests/components/profile/FollowButton.test.tsx (Task 1 — implementation must satisfy every test)
  </read_first>
  <action>
Create `src/components/profile/FollowButton.tsx` as a Client Component. First line: `'use client'`.

Props interface:
```typescript
export interface FollowButtonProps {
  viewerId: string | null          // null for unauth viewer
  targetUserId: string             // the user being followed/unfollowed
  targetDisplayName: string        // for aria-label ("Follow {name}" / "Unfollow {name}")
  initialIsFollowing: boolean
  variant?: 'primary' | 'locked' | 'inline'   // default 'primary'
}
```

Return `null` when `viewerId !== null && viewerId === targetUserId` (self-hidden, D-07/D-12; unauth case always renders the button).

Internal state:
```typescript
const router = useRouter()
const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
const [pending, startTransition] = useTransition()
const [mobileRevealed, setMobileRevealed] = useState(false)   // for D-09 two-tap mobile flow
```

Re-sync prop changes (Pitfall 4 mitigation): use `useEffect(() => setIsFollowing(initialIsFollowing), [initialIsFollowing])`.

Click handler:
```typescript
function handleClick() {
  // Unauth: redirect to sign-in, preserve return path.
  // /login route is verified to exist at src/app/login/page.tsx (see <read_first>).
  if (viewerId === null) {
    // Use window.location.pathname (same-origin only) so we don't hard-code the username —
    // and so the `next` param is always a safe relative path.
    router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`)
    return
  }

  // Mobile two-tap (D-09): if following and not yet revealed, first tap reveals "Unfollow".
  if (isFollowing && !mobileRevealed && isMobileViewport()) {
    setMobileRevealed(true)
    return
  }

  const next = !isFollowing
  // Optimistic bump
  setIsFollowing(next)
  setMobileRevealed(false)
  startTransition(async () => {
    const action = next ? followUser : unfollowUser
    const result = await action({ userId: targetUserId })
    if (!result.success) {
      // Rollback — NO toast library required this phase; console.error + rolled-back state is sufficient.
      // Plan 04 / future phases can add a toast wrapper. UI-SPEC copy is documented for the toast step.
      setIsFollowing(!next)
      console.error('[FollowButton] action failed:', result.error)
      return
    }
    // Server reconciliation — re-fetches layout, updates followerCount displayed in ProfileHeader parent.
    router.refresh()
  })
}

function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  // Tailwind sm breakpoint is 640px; below = mobile
  return window.matchMedia('(max-width: 639px)').matches
}
```

Render (per UI-SPEC Interaction Contracts):

```tsx
// Visible label decision:
// - not-following → "Follow"
// - following && !mobileRevealed → "Following" (with hover-swap markup for desktop)
// - following && mobileRevealed → "Unfollow" (mobile two-tap committed state)
const followLabel = 'Follow'
const followingLabel = 'Following'
const unfollowLabel = 'Unfollow'
const ariaLabel = isFollowing ? `Unfollow ${targetDisplayName}` : `Follow ${targetDisplayName}`

const baseClass = 'inline-flex items-center justify-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70 disabled:cursor-wait'

// Per UI-SPEC classes (map variants exactly):
const variantClass =
  variant === 'inline'
    ? `h-8 px-3 border border-border ${isFollowing ? 'bg-muted text-muted-foreground' : 'text-foreground hover:bg-muted'}`
    : // primary and locked share the same visual
      `h-8 px-4 font-semibold ${isFollowing
        ? 'bg-muted text-muted-foreground group hover:text-destructive focus:text-destructive'
        : 'bg-accent text-accent-foreground hover:opacity-90'}`

return (
  <button
    type="button"
    aria-pressed={isFollowing}
    aria-busy={pending}
    aria-label={ariaLabel}
    disabled={pending}
    onClick={handleClick}
    className={cn(baseClass, variantClass)}
  >
    {!isFollowing && followLabel}
    {isFollowing && mobileRevealed && unfollowLabel}
    {isFollowing && !mobileRevealed && (
      <>
        <span className="group-hover:hidden group-focus:hidden">{followingLabel}</span>
        <span className="hidden group-hover:inline group-focus:inline">{unfollowLabel}</span>
      </>
    )}
  </button>
)
```

Keep the component <150 lines. Export `FollowButton` as named export.

Run tests after implementation: `npx vitest run tests/components/profile/FollowButton.test.tsx --reporter=dot` — expect GREEN.

Commit message: `feat(09-02): FollowButton component with optimistic + rollback + hover-swap (FOLL-01, FOLL-02)`.
  </action>
  <verify>
    <automated>npx vitest run tests/components/profile/FollowButton.test.tsx --reporter=dot 2>&1 | tee /tmp/09-02-t2.log; grep -qE "Test Files .*passed" /tmp/09-02-t2.log &amp;&amp; grep -qE "0 failed" /tmp/09-02-t2.log</automated>
  </verify>
  <acceptance_criteria>
    - File `src/components/profile/FollowButton.tsx` exists with `'use client'` on line 1: `head -1 src/components/profile/FollowButton.tsx` outputs `'use client'`
    - Exports `FollowButton` named export: `grep -cE "^export (function |const )FollowButton" src/components/profile/FollowButton.tsx >= 1`
    - Imports `followUser, unfollowUser` from `@/app/actions/follows`: `grep -c "from '@/app/actions/follows'" src/components/profile/FollowButton.tsx >= 1`
    - Imports `useRouter` from `next/navigation` (NOT `next/router`): `grep -c "from 'next/navigation'" src/components/profile/FollowButton.tsx >= 1` AND `grep -c "from 'next/router'" src/components/profile/FollowButton.tsx` returns `0`
    - Uses `useTransition`: `grep -c "useTransition" src/components/profile/FollowButton.tsx >= 1`
    - Calls `router.refresh()` inside the success branch: `grep -c "router.refresh()" src/components/profile/FollowButton.tsx >= 1`
    - Includes rollback branch (setIsFollowing(!next) after failure): `grep -cE "setIsFollowing\\(!next\\)|setIsFollowing\\(next(False|\\? false : true)" src/components/profile/FollowButton.tsx >= 1`
    - Includes all three variants in the types: `grep -cE "'primary'|'locked'|'inline'" src/components/profile/FollowButton.tsx >= 3`
    - Uses accent fill only on primary/locked not-following state: `grep -c "bg-accent text-accent-foreground" src/components/profile/FollowButton.tsx >= 1`
    - Uses muted+destructive hover for following state: `grep -cE "bg-muted.*text-muted-foreground|hover:text-destructive|focus:text-destructive" src/components/profile/FollowButton.tsx >= 2`
    - Returns null when self (viewerId === targetUserId): `grep -cE "viewerId.*===.*targetUserId|targetUserId.*===.*viewerId" src/components/profile/FollowButton.tsx >= 1` AND `grep -c "return null" src/components/profile/FollowButton.tsx >= 1`
    - Unauth redirect path pattern `/login?next=` (grounded: route exists at src/app/login/page.tsx): `grep -c "/login?next=" src/components/profile/FollowButton.tsx >= 1`
    - Login route target is verified to exist in repo at plan time: `test -f src/app/login/page.tsx` succeeds (sanity check run before commit)
    - Unauth redirect uses encodeURIComponent on a same-origin pathname (no absolute URL built): `grep -c "encodeURIComponent(window.location.pathname)" src/components/profile/FollowButton.tsx >= 1`
    - aria-pressed + aria-busy + aria-label all present: `grep -c "aria-pressed" src/components/profile/FollowButton.tsx >= 1` AND `grep -c "aria-busy" src/components/profile/FollowButton.tsx >= 1` AND `grep -c "aria-label" src/components/profile/FollowButton.tsx >= 1`
    - All Task 1 tests pass: `npx vitest run tests/components/profile/FollowButton.test.tsx --reporter=dot` exits 0
    - Full test suite still passes: `npx vitest run --reporter=dot` exits 0
    - TypeScript strict compiles: `npx tsc --noEmit 2>&1 | grep "FollowButton.tsx" | wc -l` returns `0`
  </acceptance_criteria>
  <done>FollowButton passes all 15+ tests (GREEN), TypeScript strict clean, UI-SPEC classes match contract, unauth redirect targets the verified `/login` route with a same-origin pathname as `next` param, commit landed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Extend ProfileHeader + LockedProfileState; fetch isFollowing in layout.tsx</name>
  <files>src/components/profile/ProfileHeader.tsx, src/components/profile/LockedProfileState.tsx, src/app/u/[username]/layout.tsx, tests/components/profile/LockedProfileState.test.tsx</files>
  <read_first>
    - src/components/profile/ProfileHeader.tsx (current: only renders Edit button for owner; extend to render FollowButton for !isOwner)
    - src/components/profile/LockedProfileState.tsx (current: disabled Follow placeholder — REPLACE with live FollowButton variant="locked")
    - src/app/u/[username]/layout.tsx (current flow: fetches profile/settings/counts/watches/wearEvents; EXTEND to fetch isFollowing when viewer && !isOwner)
    - tests/components/profile/LockedProfileState.test.tsx (existing test — the "renders a disabled Follow button" case MUST be replaced since Follow is no longer disabled)
    - .planning/phases/09-follow-system-collector-profiles/09-UI-SPEC.md (ProfileHeader slot for FollowButton; LockedProfileState locked variant placement)
    - .planning/phases/09-follow-system-collector-profiles/09-CONTEXT.md (D-07 placements, D-08 private auto-accept)
    - .planning/phases/09-follow-system-collector-profiles/09-01-SUMMARY.md (isFollowing signature)
  </read_first>
  <action>
**Step A — Extend ProfileHeader.tsx:**

Add four new props to `ProfileHeaderProps`:
```typescript
// Existing props unchanged
viewerId: string | null          // null when unauthenticated (passed from layout)
targetUserId: string             // always profile.id (the owner of this profile)
initialIsFollowing: boolean      // hydrated server-side in layout.tsx
targetDisplayName: string        // displayName ?? `@${username}` (passed from layout so header need not re-compute)
```

Inside the non-edit render (the `return` at line ~42), ADD a FollowButton slot when `!isOwner`:

```tsx
{!props.isOwner && (
  <FollowButton
    viewerId={props.viewerId}
    targetUserId={props.targetUserId}
    targetDisplayName={props.targetDisplayName}
    initialIsFollowing={props.initialIsFollowing}
    variant="primary"
  />
)}
```

Place the FollowButton in the header's right-side slot where the existing "Edit Profile" button lives — make the two mutually exclusive (Edit for owner, Follow for non-owner). Preserve the existing `self-center sm:self-start` alignment.

Add import at top: `import { FollowButton } from './FollowButton'`.

**Step B — Rewrite LockedProfileState.tsx Follow slot:**

Replace the disabled Button placeholder (current lines 43-45):
```tsx
<Button disabled className="mt-4" aria-label="Follow (coming soon)">
  Follow
</Button>
```

With the live FollowButton:
```tsx
<div className="mt-4">
  <FollowButton
    viewerId={props.viewerId}
    targetUserId={props.targetUserId}
    targetDisplayName={props.displayName ?? `@${props.username}`}
    initialIsFollowing={props.initialIsFollowing}
    variant="locked"
  />
</div>
```

Add three props to `LockedProfileStateProps`:
```typescript
viewerId: string | null
targetUserId: string
initialIsFollowing: boolean
```

Add import: `import { FollowButton } from './FollowButton'`.

Remove the `Button` import if it is no longer used anywhere else in the file (it was only used by the disabled placeholder).

**Step C — Extend src/app/u/[username]/layout.tsx:**

After `const isOwner = viewerId === profile.id` (line ~34), add:

```typescript
// FOLL-03: hydrate "is this viewer already following the owner?" so the FollowButton
// renders in its correct initial state server-side. Skipped for owner (never needed)
// and unauth viewers (FollowButton renders unauth path regardless).
const initialIsFollowing = viewerId && !isOwner
  ? await isFollowing(viewerId, profile.id)
  : false
```

Add import at top:
```typescript
import { isFollowing } from '@/data/follows'
```

Update the two branches that render ProfileHeader and LockedProfileState. For LockedProfileState (line ~41):
```tsx
<LockedProfileState
  username={profile.username}
  displayName={profile.displayName ?? null}
  bio={profile.bio ?? null}
  avatarUrl={profile.avatarUrl ?? null}
  followerCount={counts.followers}
  followingCount={counts.following}
  viewerId={viewerId}
  targetUserId={profile.id}
  initialIsFollowing={initialIsFollowing}
/>
```

For ProfileHeader (line ~90):
```tsx
<ProfileHeader
  username={username}
  displayName={profile.displayName ?? null}
  bio={profile.bio ?? null}
  avatarUrl={profile.avatarUrl ?? null}
  isOwner={isOwner}
  followerCount={counts.followers}
  followingCount={counts.following}
  watchCount={ownedCount}
  wishlistCount={wishlistCount}
  tasteTags={tasteTags}
  viewerId={viewerId}
  targetUserId={profile.id}
  initialIsFollowing={initialIsFollowing}
  targetDisplayName={profile.displayName ?? `@${profile.username}`}
/>
```

**Step D — Update existing tests/components/profile/LockedProfileState.test.tsx:**

Current test `renders a disabled Follow button` must be REPLACED because Follow is no longer disabled. The test file currently renders LockedProfileState without the new props — the test will fail TS once props are required. Update ALL three existing tests to pass the new required props:
```typescript
const baseProps = {
  username: 'tyler',
  displayName: 'Tyler W',
  bio: 'A bio',
  avatarUrl: null,
  followerCount: 5,
  followingCount: 7,
  viewerId: 'viewer-uuid',
  targetUserId: 'target-uuid',
  initialIsFollowing: false,
}
```

Replace the `renders a disabled Follow button` test with:
```typescript
it('renders a live Follow button (not disabled, wired to the action)', () => {
  render(<LockedProfileState {...baseProps} />)
  const btn = screen.getByRole('button', { name: /Follow Tyler/ })
  expect(btn.hasAttribute('disabled')).toBe(false)
})

it('renders the Following state when viewer already follows', () => {
  render(<LockedProfileState {...baseProps} initialIsFollowing={true} />)
  expect(screen.getByRole('button', { name: /Unfollow Tyler/ })).toBeTruthy()
})
```

Mock `@/app/actions/follows` and `next/navigation` in the file header (copy the vi.mock pattern from FollowButton.test.tsx).

**Commit:** `feat(09-02): wire FollowButton into ProfileHeader + LockedProfileState + layout (FOLL-01..03, PROF-08)`.

Run the full suite: `npx vitest run --reporter=dot` — all tests green.
  </action>
  <verify>
    <automated>npx vitest run --reporter=dot 2>&1 | tee /tmp/09-02-t3.log; grep -qE "Test Files .*passed" /tmp/09-02-t3.log &amp;&amp; grep -qE "0 failed" /tmp/09-02-t3.log &amp;&amp; npx tsc --noEmit 2>&1 | tee /tmp/09-02-t3-tsc.log; test ! -s /tmp/09-02-t3-tsc.log || ! grep -E "(ProfileHeader|LockedProfileState|layout)\\.tsx" /tmp/09-02-t3-tsc.log</automated>
  </verify>
  <acceptance_criteria>
    - ProfileHeader renders FollowButton when not owner: `grep -c "<FollowButton" src/components/profile/ProfileHeader.tsx >= 1`
    - ProfileHeader imports FollowButton: `grep -c "from './FollowButton'" src/components/profile/ProfileHeader.tsx >= 1`
    - ProfileHeader gates FollowButton on `!props.isOwner`: `grep -cE "!props\\.isOwner.*FollowButton|isOwner.*&&.*FollowButton" src/components/profile/ProfileHeader.tsx >= 1` (or equivalent pattern)
    - ProfileHeaderProps has new fields: `grep -cE "(viewerId|targetUserId|initialIsFollowing|targetDisplayName)" src/components/profile/ProfileHeader.tsx >= 4`
    - LockedProfileState renders FollowButton with `variant="locked"`: `grep -c "variant=\"locked\"" src/components/profile/LockedProfileState.tsx >= 1`
    - LockedProfileState no longer renders a `<Button disabled` placeholder: `grep -c "disabled.*aria-label=\"Follow (coming soon)\"" src/components/profile/LockedProfileState.tsx` returns `0`
    - LockedProfileState imports FollowButton: `grep -c "from './FollowButton'" src/components/profile/LockedProfileState.tsx >= 1`
    - layout.tsx imports isFollowing DAL: `grep -c "import { isFollowing } from '@/data/follows'" src/app/u/[username]/layout.tsx >= 1` (allow alternate import styles too)
    - layout.tsx calls isFollowing conditionally: `grep -cE "isFollowing\\(viewerId, profile\\.id\\)" src/app/u/[username]/layout.tsx >= 1`
    - layout.tsx passes initialIsFollowing + targetUserId + viewerId to ProfileHeader: `grep -cE "initialIsFollowing" src/app/u/[username]/layout.tsx >= 2` (ProfileHeader + LockedProfileState)
    - layout.tsx passes targetDisplayName to ProfileHeader: `grep -c "targetDisplayName" src/app/u/[username]/layout.tsx >= 1`
    - Updated tests/components/profile/LockedProfileState.test.tsx passes new props: `grep -c "viewerId: 'viewer-uuid'" tests/components/profile/LockedProfileState.test.tsx >= 1`
    - tests/components/profile/LockedProfileState.test.tsx no longer asserts `disabled` on Follow: `grep -c "disabled.*true" tests/components/profile/LockedProfileState.test.tsx` returns `0` (or verify by looking for "renders a live Follow button")
    - Full test suite green: `npx vitest run --reporter=dot` exits 0
    - TypeScript strict clean: `npx tsc --noEmit 2>&1 | grep -E "(ProfileHeader|LockedProfileState|layout)\\.tsx" | wc -l` returns `0`
    - D-19 regression guard — owner-only UI still present on owner view: `grep -c "props.isOwner" src/components/profile/ProfileHeader.tsx >= 2` (Edit Profile button AND the NOT-isOwner gate on FollowButton)
  </acceptance_criteria>
  <done>ProfileHeader and LockedProfileState both render live FollowButton; layout.tsx fetches initialIsFollowing server-side; existing LockedProfileState tests updated and passing; full suite green; commit landed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client FollowButton → Server Action | Button posts to followUser/unfollowUser; Plan 01 Server Actions handle auth + validation — this plan trusts those. |
| Server layout.tsx → DAL (isFollowing) | Drizzle service-role bypasses RLS; `isFollowing(viewerId, profile.id)` receives IDs as function args only (no trust of auth.uid() inside SQL). |
| Unauth viewer → /login redirect | Client-side `router.push()` with user-controlled `next` param — the destination URL is derived from `window.location.pathname` (same-origin, relative). Absolute URLs are not produced by this component. `/login` route is verified to exist at `src/app/login/page.tsx`. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-10 | Tampering | Unauthenticated viewer bypasses sign-in by modifying the `next` param to an external URL | mitigate | `router.push('/login?next=' + encodeURIComponent(window.location.pathname))`. The login handler (existing in src/app/login/page.tsx — verified) must reject absolute/off-origin `next` values — documented as carry-forward audit item; Phase 9 passes only same-origin pathnames so no new exposure. |
| T-09-11 | Tampering / Repudiation | Viewer opens multiple tabs, rapid-clicks Follow/Unfollow → count drift | mitigate | Pitfall 4 mitigated: layout hydrates `initialIsFollowing` server-side every `router.refresh()`. `useEffect(() => setIsFollowing(initialIsFollowing), [initialIsFollowing])` re-syncs on prop change. Double-click is gated by `disabled={pending}`. |
| T-09-12 | Repudiation | User claims "Follow didn't work" on private profile (D-08 auto-accept + content stays locked) | mitigate (UX) | `LockedProfileState` copy stays "This profile is private." after follow (D-08 explicit — privacy is per-tab, not per-relationship). Follower count visibly increments via `router.refresh()`. Pitfall 3 documented; full messaging polish deferred. |
| T-09-13 | Information Disclosure | FollowButton on own profile would allow self-follow via UI round-trip | mitigate | Button returns `null` when `viewerId === targetUserId`. Server Action also rejects self-follow (T-09-02, Plan 01). Defense in depth. |
| T-09-14 | DoS | Spamming the Follow button causes N Server Action invocations | mitigate | `disabled={pending}` blocks re-clicks during the transition. DAL uses `onConflictDoNothing` for insert idempotency. |
</threat_model>

<verification>
1. `npx vitest run --reporter=dot` exits 0.
2. `npx tsc --noEmit` exits 0.
3. `npx eslint src/components/profile/FollowButton.tsx src/components/profile/ProfileHeader.tsx src/components/profile/LockedProfileState.tsx src/app/u/[username]/layout.tsx` reports no errors.
4. Manual smoke (documented for human UAT but not gating this plan): run `npm run dev`, visit `/u/{other-user}`, confirm Follow button renders; click → toggles to Following; F5 → count persists; click "Following" while hovering → desktop shows "Unfollow" in destructive tint; click → count decrements.
5. Owner-view regression: visit own `/u/{own-username}` — FollowButton does NOT render, Edit Profile button DOES render.
6. No new dependencies added to package.json: `git diff package.json | grep -c '^+.*"'` returns 0.
7. Unauth redirect grounding: `test -f src/app/login/page.tsx` succeeds — the `/login?next=...` redirect target exists in the repo.
</verification>

<success_criteria>
- FollowButton component is the single source of truth for all follow-surface UI. Used by ProfileHeader (primary), LockedProfileState (locked), and Plan 03's FollowerListCard (inline).
- ProfileHeader on non-owner profile renders the primary FollowButton and correctly reflects server-hydrated `initialIsFollowing`.
- ProfileHeader on owner profile renders Edit Profile button only — no Follow button visible.
- LockedProfileState's Follow button is live, not disabled; clicking writes a follow row (D-08 auto-accept) even though content stays locked.
- layout.tsx hydrates `initialIsFollowing` server-side via `isFollowing(viewerId, profile.id)` — this is the ONLY DAL call added by Plan 02, fits the existing Promise.all cadence.
- Optimistic follow/unfollow increments/decrements the count visible on ProfileHeader; `router.refresh()` reconciles with server truth; on error, local state rolls back.
- Desktop hover-swap (CSS group-hover) flips "Following" → "Unfollow" in destructive tint without JS state changes.
- Mobile (< sm breakpoint) two-tap: first tap reveals "Unfollow", second tap commits.
- Unauth viewer click navigates to `/login?next=/u/{username}` via `router.push()` — no Server Action fires; login route is verified to exist at `src/app/login/page.tsx`.
- Self-view guard: FollowButton returns null when viewerId === targetUserId (defense layer above the Server Action's self-follow rejection).
- All D-19 owner-only affordances (Edit Profile button, "+ Add Watch" card, Log Today's Wear CTA, inline edit on ProfileHeader) remain hidden on non-owner view — Plan 02 does not touch those; Plan 04 verifies the tab-level ones.
</success_criteria>

<output>
After completion, create `.planning/phases/09-follow-system-collector-profiles/09-02-SUMMARY.md` documenting:
- FollowButton component API (props, variants)
- How ProfileHeader/LockedProfileState consume it
- layout.tsx fetch flow changes
- Confirmation that `/login?next=...` redirect path is grounded (login route exists at `src/app/login/page.tsx`)
- Any UI-SPEC divergences (should be none — cite line numbers if any)
- Test count and green status
</output>
