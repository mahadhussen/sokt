import { describe, expect, it } from 'vitest'
import { PAGE_SIZE, buildSearchUrl } from './jobtech'

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
    // Standardsidan är API:ts max. Den var 25, vilket betydde att en sökning
    // på lagerarbetare (889 träffar) visade 25 jobb och tappade resten tyst.
    expect(url.searchParams.get('limit')).toBe('100')
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

describe('datumsökning', () => {
  it('frågar levande annonser om de som publicerats senast den dagen', () => {
    // published-before är exklusiv hos Platsbanken: "ute den 31:a" kräver
    // gränsen den 1:a, annars tappas allt som publicerades just den 31:a.
    const url = new URL(buildSearchUrl({ q: 'diskare', onDate: '2026-08-31' }))
    expect(url.origin).toBe('https://jobsearch.api.jobtechdev.se')
    expect(url.searchParams.get('published-before')).toBe('2026-09-01T00:00:00')
    expect(url.searchParams.get('historical-from')).toBeNull()
  })

  it('frågar arkivet om annonser vars period spände över hela dygnet', () => {
    const url = new URL(buildSearchUrl({ q: 'diskare', onDate: '2026-08-31' }, true))
    expect(url.origin).toBe('https://historical.api.jobtechdev.se')
    expect(url.searchParams.get('historical-from')).toBe('2026-08-31T00:00:00')
    expect(url.searchParams.get('historical-to')).toBe('2026-08-31T23:59:59')
  })

  it('månadsskifte och skottdag räknas rätt', () => {
    const feb = new URL(buildSearchUrl({ onDate: '2024-02-29' }))
    expect(feb.searchParams.get('published-before')).toBe('2024-03-01T00:00:00')
    const dec = new URL(buildSearchUrl({ onDate: '2026-12-31' }))
    expect(dec.searchParams.get('published-before')).toBe('2027-01-01T00:00:00')
  })

  it('utan datum rörs varken arkiv eller datumgränser', () => {
    const url = new URL(buildSearchUrl({ q: 'diskare' }))
    expect(url.origin).toBe('https://jobsearch.api.jobtechdev.se')
    expect(url.searchParams.get('published-before')).toBeNull()
  })
})

describe('ort mot arkivet', () => {
  it('skickar kommunkod till arkivet, concept-id till Platsbanken', () => {
    // Arkivet svarar 500 på concept-id (verifierat mot live-API:t). Utan
    // översättningen tappades alla borttagna annonser tyst så fort en ort
    // valdes — resultatet såg komplett ut men var halvt.
    const malmo = 'oYPt_yRA_Smm'
    const live = new URL(buildSearchUrl({ municipalityId: malmo, onDate: '2026-08-31' }))
    expect(live.searchParams.get('municipality')).toBe(malmo)
    const archive = new URL(buildSearchUrl({ municipalityId: malmo, onDate: '2026-08-31' }, true))
    expect(archive.searchParams.get('municipality')).toBe('1280')
  })

  it('utelämnar ortsfiltret i arkivet hellre än att skicka något ogiltigt', () => {
    const url = new URL(buildSearchUrl({ municipalityId: 'finns-inte' }, true))
    expect(url.searchParams.get('municipality')).toBeNull()
  })
})

describe('sidhämtning', () => {
  it('standardsidan är API:ts max och offset skickas när det finns', () => {
    expect(PAGE_SIZE).toBe(100)
    const first = new URL(buildSearchUrl({ q: 'lagerarbetare' }))
    expect(first.searchParams.get('limit')).toBe('100')
    expect(first.searchParams.has('offset')).toBe(false)
    const second = new URL(buildSearchUrl({ q: 'lagerarbetare', offset: 100 }))
    expect(second.searchParams.get('offset')).toBe('100')
  })
})
