import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ExplorePage from '@/app/explore/page'

describe('/explore stub (Phase 14 NAV-11 D-18)', () => {
  it('renders the "Discovery is coming." heading', () => {
    render(<ExplorePage />)
    expect(
      screen.getByRole('heading', { name: /discovery is coming\./i }),
    ).toBeInTheDocument()
  })
  it('renders the teaser copy verbatim', () => {
    render(<ExplorePage />)
    expect(
      screen.getByText(
        /Explore will surface watches, collectors, and taste clusters curated to your collection\. Check back soon\./i,
      ),
    ).toBeInTheDocument()
  })
  it('renders a Sparkles-iconish svg', () => {
    const { container } = render(<ExplorePage />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
  it('default export is a function', () => {
    expect(typeof ExplorePage).toBe('function')
  })
})
