import { describe, expect, it } from 'vitest'
import { newJobIds, savedSearchSummary } from './savedSearch'

describe('newJobIds', () => {
  it('returns ids not in the seen set, preserving order', () => {
    expect(newJobIds(['c', 'a', 'd', 'b'], ['a', 'b'])).toEqual(['c', 'd'])
  })

  it('treats no seen set as everything being new', () => {
    expect(newJobIds(['a', 'b'])).toEqual(['a', 'b'])
  })

  it('is empty when nothing changed', () => {
    expect(newJobIds(['a', 'b'], ['a', 'b'])).toEqual([])
  })
})

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
