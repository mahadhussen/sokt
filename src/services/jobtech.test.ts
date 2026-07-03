import { describe, expect, it } from 'vitest'
import { buildSearchUrl } from './jobtech'

describe('buildSearchUrl', () => {
  it('sends q, municipality and worktime-extent as JobTech params', () => {
    const url = new URL(
      buildSearchUrl({
        q: 'lokalvårdare',
        municipalityId: 'otaF_bQY_4ZD',
        worktimeExtentId: '6YE1_gAC_R2G',
        limit: 25,
      }),
    )
    expect(url.pathname).toBe('/search')
    expect(url.searchParams.get('q')).toBe('lokalvårdare')
    expect(url.searchParams.get('municipality')).toBe('otaF_bQY_4ZD')
    expect(url.searchParams.get('worktime-extent')).toBe('6YE1_gAC_R2G')
    expect(url.searchParams.get('limit')).toBe('25')
  })

  it('omits filters that are not set', () => {
    const url = new URL(buildSearchUrl({ q: 'diskare' }))
    expect(url.searchParams.get('q')).toBe('diskare')
    expect(url.searchParams.has('municipality')).toBe(false)
    expect(url.searchParams.has('worktime-extent')).toBe(false)
    expect(url.searchParams.get('limit')).toBe('25')
  })

  it('defaults to the jobsearch host', () => {
    expect(buildSearchUrl({}).startsWith('https://jobsearch.api.jobtechdev.se/search')).toBe(true)
  })
})
