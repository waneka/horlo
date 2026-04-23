'use client'

import * as React from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'

const options = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
] as const

/**
 * InlineThemeSegmented — 3-button segmented row for Light/Dark/System.
 * Rendered inline inside the profile dropdown (D-17), replacing the
 * separate ThemeToggle Popover in the top nav strip. `useTheme()` is a
 * client hook, so this component is marked 'use client'; the surrounding
 * UserMenu can remain a Server Component.
 */
export function InlineThemeSegmented() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const current = mounted ? theme ?? 'system' : 'system'

  return (
    <div className="flex w-full items-stretch rounded border border-border">
      {options.map(({ value, label, Icon }, i) => {
        const selected = current === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 px-2 py-1.5 text-xs',
              i === 0 && 'rounded-l',
              i === options.length - 1 && 'rounded-r',
              selected
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/10',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
