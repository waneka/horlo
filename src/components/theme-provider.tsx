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

function readThemeCookie(): Theme {
  if (typeof document === 'undefined') return 'system'
  const match = document.cookie.match(/(?:^|;\s*)horlo-theme=(light|dark)(?:;|$)/)
  return match ? (match[1] as Theme) : 'system'
}

function readResolvedFromDom(): ResolvedTheme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (resolved === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
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
}: {
  children: React.ReactNode
}) {
  // SSR-safe initial state: theme + resolvedTheme default to neutral values
  // that match the server render, then reconcile from the DOM on mount. The
  // blocking inline <script> in layout.tsx has already set the correct
  // `dark` class on <html> before hydration, so readResolvedFromDom() in
  // the mount effect is authoritative.
  const [theme, setThemeState] = React.useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>('light')

  // Mount: sync React state to whatever the inline script / cookie / system
  // already decided. No double-apply — applyTheme is called only if the DOM
  // somehow disagrees with the cookie (defensive).
  React.useEffect(() => {
    const stored = readThemeCookie()
    setThemeState(stored)
    const resolved = stored === 'system' ? getSystemTheme() : stored
    setResolvedTheme(resolved)
    if (readResolvedFromDom() !== resolved) applyTheme(resolved)
  }, [])

  // When theme === 'system', follow OS-level prefers-color-scheme changes.
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
