import { Skeleton } from '@/components/ui/skeleton'

/**
 * Phase 39c D-39c-06: chrome-only loading skeleton for the profile shell.
 *
 * Renders the public-branch chrome shape so the Suspense swap from skeleton →
 * resolved profile is dimensionally stable on the dominant path. Per D-39c-06,
 * this skeleton intentionally accepts small CLS on the locked-branch fork
 * (tab pills + content card disappear) in exchange for zero-CLS on the public-
 * branch fork (the majority case).
 *
 * Element dimensions from 39C-UI-SPEC § Component Inventory → <ProfileShellSkeleton/>:
 *   - Avatar circle:      size-24 rounded-full  (96px — matches AvatarDisplay size={96})
 *   - Name placeholder:   h-6 w-48             (24px height, 192px width)
 *   - Tab pills (×5):     h-9 w-20 rounded-md  (36px height, 80px width each)
 *   - Content card:       h-64 rounded-xl border (256px height)
 *
 * No `'use client'` directive — Server-Component-safe. No visible text per D-39c-06.
 */
export function ProfileShellSkeleton() {
  return (
    <div className="space-y-6" data-testid="profile-shell-skeleton">
      {/* Header row: avatar circle + name placeholder */}
      <div className="flex items-center gap-4">
        <Skeleton className="size-24 rounded-full" />
        <Skeleton className="h-6 w-48" />
      </div>

      {/* Tab pill row: 5 fixed-width pills mirroring ProfileTabs base tabs */}
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 shrink-0 rounded-md" />
        ))}
      </div>

      {/* Content card placeholder */}
      <Skeleton className="h-64 w-full rounded-xl border" />
    </div>
  )
}

/**
 * Narrower content-only skeleton used by `loading.tsx` for tab-segment
 * navigations. When the user clicks between tabs (collection → wishlist →
 * worn → ...), the `/u/[username]` layout segment stays mounted, the chrome
 * (avatar, header, tab strip) rendered by ProfileGate stays on screen, and
 * only the `[tab]/page.tsx` child suspends. Rendering only the content card
 * placeholder here avoids visually duplicating the chrome skeleton during
 * the brief in-flight window. For first-load cold cases where ProfileGate
 * itself suspends, the layout's own `<Suspense fallback={<ProfileShellSkeleton/>}>`
 * still renders the full chrome skeleton.
 */
export function ProfileTabContentSkeleton() {
  return (
    <div className="space-y-6" data-testid="profile-tab-content-skeleton">
      <Skeleton className="h-64 w-full rounded-xl border" />
    </div>
  )
}
