'use client'

import * as React from 'react'
import { useTheme } from '@/components/theme-provider'
import { Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const options = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
] as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const current = mounted ? theme ?? 'system' : 'system'
  const CurrentIcon =
    options.find((o) => o.value === current)?.Icon ?? Monitor

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Theme"
            className="h-11 w-11"
          />
        }
      >
        <CurrentIcon className="h-5 w-5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-40 p-1">
        {options.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            className={cn(
              'flex w-full items-center gap-2 rounded px-3 py-2 text-sm',
              'hover:bg-accent hover:text-accent-foreground',
              current === value && 'bg-accent text-accent-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
