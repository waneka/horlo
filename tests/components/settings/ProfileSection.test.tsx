import { describe, it } from 'vitest'

// ---------------------------------------------------------------------------
// Phase 22 D-19 — Profile tab read-only stub RED skeleton.
// Phase 22 ships a non-interactive panel (displayName / @username / avatar /
// "View public profile" link / "Profile editing coming in the next update"
// footer note); editable form lands in Phase 25 (UX-08).
// ---------------------------------------------------------------------------

describe('ProfileSection — Phase 22 D-19 read-only stub', () => {
  it.todo('renders displayName when present, falls back to username')
  it.todo('renders @username at text-sm text-muted-foreground')
  it.todo('renders View public profile link to /u/{username}')
  it.todo('renders avatar image when avatarUrl is present')
  it.todo('renders muted bg-muted placeholder when avatarUrl is null')
  it.todo('renders "Profile editing coming in the next update." footer note')
})
