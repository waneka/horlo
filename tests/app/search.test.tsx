import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SearchPage from '@/app/search/page'

describe('/search stub (Phase 14 NAV-11 D-19)', () => {
  it('renders the "Search is coming." heading', () => {
    render(<SearchPage />)
    expect(
      screen.getByRole('heading', { name: /search is coming\./i }),
    ).toBeInTheDocument()
  })
  it('renders the teaser copy verbatim', () => {
    render(<SearchPage />)
    expect(
      screen.getByText(
        /Find collectors by name, discover taste overlap, and follow people who wear what you love\. Check back soon\./i,
      ),
    ).toBeInTheDocument()
  })
  it('renders a Search-iconish svg', () => {
    const { container } = render(<SearchPage />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
  it('default export is a function', () => {
    expect(typeof SearchPage).toBe('function')
  })
})
