import { describe, expect, it } from 'vitest'
import { savedSearchSummary } from './savedSearch'

const muni = (id: string) => (id === 'm1' ? 'Uppsala' : undefined)
const work = (id: string) => (id === 'w1' ? 'Heltid' : undefined)

describe('savedSearchSummary', () => {
  it('joins the active filters', () => {
    expect(
      savedSearchSummary({ q: 'lokalvårdare', municipalityId: 'm1', worktimeExtentId: 'w1' }, muni, work),
    ).toBe('lokalvårdare · Uppsala · Heltid')
  })

  it('omits empty filters', () => {
    expect(
      savedSearchSummary({ q: 'diskare', municipalityId: '', worktimeExtentId: '' }, muni, work),
    ).toBe('diskare')
  })

  it('falls back to "Alla jobb" when nothing is set', () => {
    expect(savedSearchSummary({ q: '', municipalityId: '', worktimeExtentId: '' }, muni, work)).toBe(
      'Alla jobb',
    )
  })
})
