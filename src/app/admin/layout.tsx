// D-05: Owner-gated server-component layout for the /admin segment.
//
// This layout guard is UX-layer only. Next.js 16 Partial Rendering does NOT
// re-execute layouts on subsequent client-side navigations within /admin —
// assertOwner() in every Server Action (D-06) is the actual security gate.
// Three-layer security: RLS write policies (DB) + this layout redirect (UX) +
// assertOwner() in every CMS Server Action (SA).
import { redirect } from 'next/navigation'
import { assertOwner } from '@/lib/auth'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // CRITICAL: assertOwner() throws UnauthorizedError for non-admins.
  // redirect() throws NEXT_REDIRECT internally — keep it OUTSIDE any nested
  // try/catch (Pitfall 7: Next.js does not propagate NEXT_REDIRECT from
  // inside a nested try block). Only set a flag from catch, then redirect.
  try {
    await assertOwner()
  } catch {
    redirect('/')
  }

  // UI-SPEC §Layout: max-w-2xl, same max-width as watch form pages (px-4 py-8).
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      {children}
    </main>
  )
}
