'use client'

import * as React from 'react'

type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

const COOKIE_KEY = 'horlo-theme'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
  root.style.colorScheme = resolved
}

function writeCookie(value: Theme) {
  if (typeof document === 'undefined') return
  if (value === 'system') {
    document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; samesite=lax`
  } else {
    document.cookie = `${COOKIE_KEY}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`
  }
}

export function ThemeProvider({
  children,
  initialTheme = 'system',
}: {
  children: React.ReactNode
  initialTheme?: Theme
}) {
  const [theme, setThemeState] = React.useState<Theme>(initialTheme)
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>(
    initialTheme === 'dark' ? 'dark' : 'light',
  )

  React.useEffect(() => {
    if (initialTheme === 'system') {
      const resolved = getSystemTheme()
      setResolvedTheme(resolved)
      applyTheme(resolved)
    }
  }, [initialTheme])

  React.useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => {
      const resolved = getSystemTheme()
      setResolvedTheme(resolved)
      applyTheme(resolved)
    }
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }, [theme])

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next)
    writeCookie(next)
    const resolved = next === 'system' ? getSystemTheme() : next
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [])

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) {
    return {
      theme: undefined as Theme | undefined,
      resolvedTheme: 'light' as ResolvedTheme,
      setTheme: () => {},
    }
  }
  return ctx
}
