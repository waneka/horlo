import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SettingsSection } from './SettingsSection'

interface ProfileSectionProps {
  username: string
  displayName: string | null
  avatarUrl: string | null
}

/**
 * Phase 22 D-19 — Profile tab read-only stub.
 *
 * Intentionally non-interactive. Renders avatar (or muted bg-muted
 * placeholder), displayName/@username pair, and a "View public profile" link
 * to /u/{username}. Phase 25 (UX-08) replaces this stub with a profile-edit
 * form.
 *
 * Locked copy from UI-SPEC Copywriting Contract (lines 252-259):
 *   - Footer note: "Profile editing coming in the next update."
 */
export function ProfileSection({
  username,
  displayName,
  avatarUrl,
}: ProfileSectionProps) {
  return (
    <SettingsSection title="Profile">
      <div className="flex items-start gap-4">
        {avatarUrl ? (
          // Avatar URL is server-fetched from a sanitized Supabase Storage CDN
          // (Phase 19.1 upload pipeline); React's setAttribute('src', ...)
          // path is safe for trusted https URLs (T-22-X1 mitigation).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="size-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            className="size-16 shrink-0 rounded-full bg-muted"
            aria-hidden
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-foreground">
            {displayName ?? username}
          </p>
          <p className="text-sm text-muted-foreground">@{username}</p>
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/u/${username}`} />}
            >
              View public profile
            </Button>
          </div>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Profile editing coming in the next update.
      </p>
    </SettingsSection>
  )
}
