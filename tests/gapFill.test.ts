import { describe, it, expect } from 'vitest'
import { computeGapFill } from '@/lib/gapFill'
import { makeWatch, emptyPreferences, preferencesWithGoal, fixtures } from './fixtures/watches'

describe('computeGapFill', () => {
  it('returns first-watch for empty collection', () => {
    const target = makeWatch({ styleTags: ['dive'], roleTags: ['daily'], dialColor: 'black' })
    const result = computeGapFill(target, [], emptyPreferences)
    expect(result.kind).toBe('first-watch')
    expect(result.score).toBeNull()
    expect(result.goalUsed).toBe('balanced')
  })

  it('falls back to balanced when owned < 3 even under specialist', () => {
    const target = makeWatch({ styleTags: ['dress'], roleTags: ['formal'], dialColor: 'white' })
    const collection = [
      makeWatch({ styleTags: ['dive'], roleTags: ['daily'], dialColor: 'black' }),
      makeWatch({ styleTags: ['dive'], roleTags: ['daily'], dialColor: 'black' }),
    ]
    const result = computeGapFill(target, collection, preferencesWithGoal('specialist'))
    expect(result.kind).toBe('numeric')
    expect(result.goalUsed).toBe('balanced')
  })

  it('returns outside-specialty for specialist + off-specialty target', () => {
    const target = makeWatch({ styleTags: ['dress'], roleTags: ['formal'], dialColor: 'white' })
    const result = computeGapFill(target, fixtures.threeSameStyle(), preferencesWithGoal('specialist'))
    expect(result.kind).toBe('outside-specialty')
    expect(result.score).toBeNull()
  })

  it('returns numeric score for specialist + on-specialty target', () => {
    const target = makeWatch({ styleTags: ['dive'], roleTags: ['formal'], dialColor: 'green' })
    const result = computeGapFill(target, fixtures.threeSameStyle(), preferencesWithGoal('specialist'))
    expect(result.kind).toBe('numeric')
    expect(typeof result.score).toBe('number')
  })

  it('returns off-brand for brand-loyalist + off-brand target', () => {
    const target = makeWatch({ brand: 'Tudor', styleTags: ['dive'], roleTags: ['daily'] })
    const result = computeGapFill(target, fixtures.threeSameBrand(), preferencesWithGoal('brand-loyalist'))
    expect(result.kind).toBe('off-brand')
  })

  it('returns numeric for brand-loyalist + on-brand target', () => {
    const target = makeWatch({
      brand: 'Rolex',
      model: 'GMT-Master',
      styleTags: ['sport'],
      roleTags: ['travel'],
      dialColor: 'black',
    })
    const result = computeGapFill(target, fixtures.threeSameBrand(), preferencesWithGoal('brand-loyalist'))
    expect(result.kind).toBe('numeric')
  })

  it('returns breaks-theme for variety-within-theme when target misses dominant traits', () => {
    const themedCollection = [
      makeWatch({
        designTraits: ['sport-chic', 'integrated-bracelet'],
        styleTags: ['sport'],
        roleTags: ['daily'],
        dialColor: 'blue',
      }),
      makeWatch({
        designTraits: ['sport-chic', 'integrated-bracelet'],
        styleTags: ['dress'],
        roleTags: ['formal'],
        dialColor: 'silver',
      }),
      makeWatch({
        designTraits: ['sport-chic', 'integrated-bracelet'],
        styleTags: ['chrono'],
        roleTags: ['sport'],
        dialColor: 'black',
      }),
    ]
    const target = makeWatch({
      designTraits: ['rugged'],
      styleTags: ['field'],
      roleTags: ['outdoor'],
      dialColor: 'green',
    })
    const result = computeGapFill(target, themedCollection, preferencesWithGoal('variety-within-theme'))
    expect(result.kind).toBe('breaks-theme')
  })

  it('returns numeric 0 when every target tuple is already covered', () => {
    // Three distinct owned watches all share (dive, daily, black) tuple;
    // target is identical → no new tuples → score 0.
    const collection = [
      makeWatch({ styleTags: ['dive'], roleTags: ['daily'], dialColor: 'black' }),
      makeWatch({ styleTags: ['dive'], roleTags: ['daily'], dialColor: 'black' }),
      makeWatch({ styleTags: ['dive'], roleTags: ['daily'], dialColor: 'black' }),
    ]
    const target = makeWatch({ styleTags: ['dive'], roleTags: ['daily'], dialColor: 'black' })
    const result = computeGapFill(target, collection, emptyPreferences)
    expect(result.kind).toBe('numeric')
    expect(result.score).toBe(0)
  })

  it('returns numeric > 0 when target introduces a novel tuple', () => {
    const collection = fixtures.fiveMixed()
    const target = makeWatch({ styleTags: ['pilot'], roleTags: ['travel'], dialColor: 'green' })
    const result = computeGapFill(target, collection, emptyPreferences)
    expect(result.kind).toBe('numeric')
    expect(result.score).toBeGreaterThan(0)
  })
})
