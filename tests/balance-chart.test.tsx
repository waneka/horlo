import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BalanceChart } from '@/components/insights/BalanceChart'

// Recharts uses ResizeObserver which jsdom lacks — stub it.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error — assign stub
globalThis.ResizeObserver = ResizeObserverStub

describe('BalanceChart', () => {
  it('renders empty state copy when data is empty', () => {
    render(<BalanceChart title="Style Distribution" data={[]} />)
    expect(screen.getByText('Style Distribution')).toBeInTheDocument()
    expect(screen.getByText('Not enough data yet.')).toBeInTheDocument()
  })

  it('renders custom empty message', () => {
    render(
      <BalanceChart
        title="Roles"
        data={[]}
        emptyMessage="No role data."
      />
    )
    expect(screen.getByText('No role data.')).toBeInTheDocument()
  })

  it('renders chart with data and aria-label summary', () => {
    const data = [
      { label: 'dive', count: 5, percentage: 50 },
      { label: 'dress', count: 3, percentage: 30 },
      { label: 'field', count: 2, percentage: 20 },
    ]
    render(<BalanceChart title="Style Distribution" data={data} />)
    expect(screen.getByText('Style Distribution')).toBeInTheDocument()
    const chart = document.querySelector('[aria-label*="Style Distribution"]')
    expect(chart).not.toBeNull()
    expect(chart?.getAttribute('aria-label')).toContain('dive: 5')
  })

  it('handles single-entry data without throwing', () => {
    const data = [{ label: 'dive', count: 1, percentage: 100 }]
    expect(() =>
      render(<BalanceChart title="Solo" data={data} />)
    ).not.toThrow()
  })
})
