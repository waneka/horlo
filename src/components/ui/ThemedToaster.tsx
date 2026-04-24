'use client'

import { Toaster as SonnerToaster, type ToasterProps } from 'sonner'
import { useTheme } from '@/components/theme-provider'

/**
 * Horlo's Sonner wrapper. Bound to the project's CUSTOM ThemeProvider
 * (src/components/theme-provider.tsx) — NOT next-themes. The npx-shadcn-
 * add-sonner scaffold would import next-themes directly, which reads
 * cookies() and breaks under cacheComponents: true (Phase 10 decision).
 *
 * Mount requirements (Pitfall H-1):
 *   - INSIDE <ThemeProvider> so useTheme() works
 *   - OUTSIDE every <Suspense> so transitions don't unmount the toast layer
 *   See src/app/layout.tsx for the canonical mount point.
 *
 * Toast call site discipline (Pitfall H-2):
 *   - Call `toast.success('...')` from a Client Component handler
 *   - NEVER from a Server Action (no DOM server-side; silent failure)
 */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <SonnerToaster
      theme={resolvedTheme as ToasterProps['theme']}
      position="bottom-center"
      richColors
    />
  )
}
