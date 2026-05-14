import { Suspense } from 'react'
import { ProfileGate } from './profile-gate'
import { ProfileShellSkeleton } from './profile-shell-skeleton'

export default async function ProfileLayout({
  children,
  params,
}: LayoutProps<'/u/[username]'>) {
  const { username } = await params
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
      <Suspense fallback={<ProfileShellSkeleton />}>
        <ProfileGate username={username}>{children}</ProfileGate>
      </Suspense>
    </main>
  )
}
