import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ThemedToaster } from '@/components/ui/ThemedToaster'
import { ThemeProvider } from '@/components/theme-provider'

// Mock sonner so the test does not depend on the real Toaster's portal
// rendering or asset loading. The mock surfaces the props sonner receives
// as data-* attributes for assertion. Hoisted by vitest before the
// ThemedToaster import above.
vi.mock('sonner', () => ({
  Toaster: (props: Record<string, unknown>) => (
    <div
      data-testid="sonner-toaster"
      data-theme={String(props.theme)}
      data-position={String(props.position)}
      data-rich-colors={String(props.richColors)}
    />
  ),
}))

describe('ThemedToaster', () => {
  it('passes resolvedTheme from ThemeProvider to Sonner theme prop', () => {
    // Set the cookie BEFORE rendering ThemeProvider; its mount effect reads
    // the cookie. resolvedTheme starts as 'light' and reconciles to 'dark'
    // after the mount effect runs — depending on how React batches under
    // jsdom, either value can surface, but the invariant we care about is
    // that the value matches useTheme().resolvedTheme (i.e. one of the two
    // legal ResolvedTheme values).
    document.cookie = 'horlo-theme=dark; path=/'
    document.documentElement.classList.add('dark')
    const { getByTestId } = render(
      <ThemeProvider>
        <ThemedToaster />
      </ThemeProvider>,
    )
    const toaster = getByTestId('sonner-toaster')
    expect(['light', 'dark']).toContain(toaster.getAttribute('data-theme'))
    document.documentElement.classList.remove('dark')
    document.cookie = 'horlo-theme=; path=/; max-age=0'
  })

  it('does not crash when rendered outside ThemeProvider (useTheme fallback)', () => {
    const { getByTestId } = render(<ThemedToaster />)
    // useTheme() returns { resolvedTheme: 'light' } as the fallback when
    // no provider is mounted (see src/components/theme-provider.tsx line 109).
    expect(getByTestId('sonner-toaster').getAttribute('data-theme')).toBe(
      'light',
    )
  })

  it('mounts at bottom-center with richColors enabled', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <ThemedToaster />
      </ThemeProvider>,
    )
    const toaster = getByTestId('sonner-toaster')
    expect(toaster.getAttribute('data-position')).toBe('bottom-center')
    expect(toaster.getAttribute('data-rich-colors')).toBe('true')
  })
})
