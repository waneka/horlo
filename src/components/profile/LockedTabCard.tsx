import Link from 'next/link';

import FollowButton from '@/components/profile/FollowButton';
import { Lock } from 'lucide-react';

type LockedTabCardProps = {
  tabLabel: string;
  ownerDisplayName: string;
  targetProfile: {
    id: string;
    username: string;
  };
  viewerId: string | null;
  initialIsFollowing: boolean;
  currentPath: string;
};

/**
 * Server Component — surfaces the gated state of a private profile tab.
 *
 * Phase 39b-03 (NSV-14): elevates the locked tab from a passive stub into an
 * active conversion surface. When the viewer is signed out we send them to
 * /auth/signin with an `encodeURIComponent`-wrapped `redirectTo` (T-39b-03
 * mitigation against open-redirect via `redirectTo`). When the viewer is
 * signed in we inline the FollowButton client component so a single tap can
 * unlock the relationship — the next request resolves to the unlocked tab
 * because the page-level guard is re-evaluated.
 *
 * Pitfall 8 (Server-imports-Client): FollowButton is a client component but
 * this file omits `'use client'` on purpose. Importing a client component
 * from a server component is the supported boundary in App Router — Next
 * inserts the serialization shim automatically. Pattern verified in
 * `src/components/explore/PopularCollectorRow.tsx`.
 */
export default function LockedTabCard({
  tabLabel,
  ownerDisplayName,
  targetProfile,
  viewerId,
  initialIsFollowing,
  currentPath,
}: LockedTabCardProps) {
  const isSignedIn = viewerId !== null;

  return (
    <div
      data-testid="locked-tab-card"
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card px-6 py-12 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Lock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">
          {tabLabel} is private
        </h2>
        <p className="text-sm text-muted-foreground">
          Follow {ownerDisplayName} to see their {tabLabel.toLowerCase()}.
        </p>
      </div>

      {isSignedIn ? (
        <div className="flex flex-col items-center gap-2">
          <FollowButton
            targetUserId={targetProfile.id}
            targetUsername={targetProfile.username}
            initialIsFollowing={initialIsFollowing}
          />
          <p className="text-xs text-muted-foreground">
            Following unlocks this tab on the next page load.
          </p>
        </div>
      ) : (
        <Link
          href={`/auth/signin?redirectTo=${encodeURIComponent(currentPath)}`}
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Sign in to follow
        </Link>
      )}
    </div>
  );
}
