import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { InlineThemeSegmented } from '@/components/layout/InlineThemeSegmented'

const setTheme = vi.fn()
let currentTheme: string | undefined = 'system'

vi.mock('@/components/theme-provider', () => ({
  useTheme: () => ({ theme: currentTheme, setTheme }),
}))

describe('InlineThemeSegmented (Phase 14 NAV-08 D-17)', () => {
  beforeEach(() => {
    setTheme.mockClear()
    currentTheme = 'system'
  })

  it('Test 1 — renders 3 buttons labeled Light, Dark, System', () => {
    render(<InlineThemeSegmented />)
    expect(screen.getByRole('button', { name: 'Light' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'System' })).toBeInTheDocument()
  })

  it('Test 2 — each button contains its lucide icon svg', () => {
    render(<InlineThemeSegmented />)
    const light = screen.getByRole('button', { name: 'Light' })
    const dark = screen.getByRole('button', { name: 'Dark' })
    const system = screen.getByRole('button', { name: 'System' })
    expect(light.querySelector('svg')).toBeTruthy()
    expect(dark.querySelector('svg')).toBeTruthy()
    expect(system.querySelector('svg')).toBeTruthy()
  })

  it('Test 3 — clicking Light calls setTheme("light")', () => {
    render(<InlineThemeSegmented />)
    fireEvent.click(screen.getByRole('button', { name: 'Light' }))
    expect(setTheme).toHaveBeenCalledWith('light')
  })

  it('Test 4 — clicking Dark calls setTheme("dark")', () => {
    render(<InlineThemeSegmented />)
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    expect(setTheme).toHaveBeenCalledWith('dark')
  })

  it('Test 5 — clicking System calls setTheme("system")', () => {
    render(<InlineThemeSegmented />)
    fireEvent.click(screen.getByRole('button', { name: 'System' }))
    expect(setTheme).toHaveBeenCalledWith('system')
  })

  it('Test 6 — selected theme button has aria-pressed="true"; others have aria-pressed="false"', async () => {
    currentTheme = 'dark'
    await act(async () => {
      render(<InlineThemeSegmented />)
    })
    const light = screen.getByRole('button', { name: 'Light' })
    const dark = screen.getByRole('button', { name: 'Dark' })
    const system = screen.getByRole('button', { name: 'System' })
    expect(dark.getAttribute('aria-pressed')).toBe('true')
    expect(light.getAttribute('aria-pressed')).toBe('false')
    expect(system.getAttribute('aria-pressed')).toBe('false')
  })

  it('Test 7 — before mount (theme undefined) defaults to System selected', () => {
    currentTheme = undefined
    // Rendering synchronously, without waiting for useEffect to flip `mounted`
    // to true, models the pre-mount state. React 18+ under jsdom still runs
    // effects before render returns, so we rely on the component's own guard:
    // when `mounted` is false it falls back to 'system' regardless of theme.
    render(<InlineThemeSegmented />)
    const system = screen.getByRole('button', { name: 'System' })
    // After mount, current === theme ?? 'system' → still 'system' because
    // theme is undefined. Selected therefore remains 'system'.
    expect(system.getAttribute('aria-pressed')).toBe('true')
  })
})
