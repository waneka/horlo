import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'next-themes'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

describe('ThemeToggle', () => {
  it('renders a Theme button', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ThemeToggle />
      </ThemeProvider>
    )
    expect(screen.getByRole('button', { name: 'Theme' })).toBeInTheDocument()
  })

  it('offers light / dark / system options on open', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ThemeToggle />
      </ThemeProvider>
    )
    await user.click(screen.getByRole('button', { name: 'Theme' }))
    expect(await screen.findByText('Light')).toBeInTheDocument()
    expect(screen.getByText('Dark')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()
  })
})
