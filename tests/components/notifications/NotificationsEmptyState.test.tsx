import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Lucide icons render as SVG in test — just ensure they're present
vi.mock('lucide-react', () => ({
  Inbox: ({ className, 'aria-hidden': ariaHidden }: { className?: string; 'aria-hidden'?: boolean }) => (
    <svg data-testid="inbox-icon" className={className} aria-hidden={ariaHidden} />
  ),
}))

import { NotificationsEmptyState } from '@/components/notifications/NotificationsEmptyState'

describe('NotificationsEmptyState', () => {
  it('renders the locked heading copy', () => {
    render(<NotificationsEmptyState />)
    expect(
      screen.getByRole('heading', { name: /you're all caught up/i }),
    ).toBeTruthy()
  })

  it('renders the Inbox icon', () => {
    render(<NotificationsEmptyState />)
    expect(screen.getByTestId('inbox-icon')).toBeTruthy()
  })

  it('renders the locked body copy', () => {
    render(<NotificationsEmptyState />)
    expect(
      screen.getByText(
        'Notifications from followers and collectors will appear here.',
      ),
    ).toBeTruthy()
  })

  it('body paragraph has role="status" for accessibility', () => {
    render(<NotificationsEmptyState />)
    const status = screen.getByRole('status')
    expect(status).toBeTruthy()
    expect(status.textContent).toContain('Notifications from followers')
  })

  it('Inbox icon has size-10 class', () => {
    render(<NotificationsEmptyState />)
    const icon = screen.getByTestId('inbox-icon')
    // SVG className is SVGAnimatedString in jsdom — use getAttribute instead
    expect(icon.getAttribute('class')).toContain('size-10')
  })

  it('Inbox icon has muted-foreground/40 class', () => {
    render(<NotificationsEmptyState />)
    const icon = screen.getByTestId('inbox-icon')
    expect(icon.getAttribute('class')).toContain('text-muted-foreground/40')
  })
})
