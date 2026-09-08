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
    expect(url.searchParams.has('open_for_all')).toBe(false)
    expect(url.searchParams.get('limit')).toBe('25')
  })

  it('sends open_for_all with exactly that name — the API silently ignores unknown params', () => {
    // Verified live 2026-09-08: open_for_all=true cut lokalvårdare from 981
    // to 49 hits, while a misspelled open-for-all changed nothing at all.
    const url = new URL(buildSearchUrl({ q: 'lokalvårdare', openForAll: true }))
    expect(url.searchParams.get('open_for_all')).toBe('true')
    expect(
      new URL(buildSearchUrl({ q: 'x', openForAll: false })).searchParams.has('open_for_all'),
    ).toBe(false)
  })

  it('defaults to the jobsearch host', () => {
    expect(buildSearchUrl({}).startsWith('https://jobsearch.api.jobtechdev.se/search')).toBe(true)
  })
})
