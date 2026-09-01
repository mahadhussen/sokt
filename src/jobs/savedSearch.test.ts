import { describe, expect, it } from 'vitest'
import {
  MAX_SAVED_SEARCHES,
  MAX_SEEN_JOB_IDS,
  evictOverCap,
  findSavedSearch,
  mergeRestoredSearches,
  mergeSeenJobIds,
  newJobIds,
  savedSearchSummary,
  searchKey,
  upsertSearch,
} from './savedSearch'
import type { SavedSearch } from './savedSearch'

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

function saved(partial: Partial<SavedSearch> & { id: string }): SavedSearch {
  return { name: partial.id, q: '', municipalityId: '', worktimeExtentId: '', ...partial }
}

describe('searchKey', () => {
  it('ignores case and surrounding spaces in the query', () => {
    expect(searchKey({ q: ' Diskare ', municipalityId: 'm1', worktimeExtentId: 'w1' })).toBe(
      searchKey({ q: 'diskare', municipalityId: 'm1', worktimeExtentId: 'w1' }),
    )
  })

  it('separates the fields so values cannot bleed into each other', () => {
    expect(searchKey({ q: 'a', municipalityId: 'b', worktimeExtentId: '' })).not.toBe(
      searchKey({ q: 'a b', municipalityId: '', worktimeExtentId: '' }),
    )
  })

  it('distinguishes different filters', () => {
    expect(searchKey({ q: 'diskare', municipalityId: 'm1', worktimeExtentId: '' })).not.toBe(
      searchKey({ q: 'diskare', municipalityId: 'm2', worktimeExtentId: '' }),
    )
  })
})

describe('findSavedSearch', () => {
  const list = [
    saved({ id: 'a', q: 'diskare', municipalityId: 'm1' }),
    saved({ id: 'b', q: 'lokalvårdare' }),
  ]

  it('finds by normalized key', () => {
    expect(findSavedSearch(list, { q: '  DISKARE', municipalityId: 'm1', worktimeExtentId: '' })?.id).toBe('a')
  })

  it('returns undefined when no filters match', () => {
    expect(findSavedSearch(list, { q: 'diskare', municipalityId: '', worktimeExtentId: '' })).toBeUndefined()
  })
})

describe('upsertSearch', () => {
  it('appends a new search at the end with lastUsedAt set', () => {
    const list = [saved({ id: 'a', q: 'diskare' })]
    const next = upsertSearch(list, saved({ id: 'b', q: 'lokalvårdare' }), 1000)
    expect(next.map((s) => s.id)).toEqual(['a', 'b'])
    expect(next[1].lastUsedAt).toBe(1000)
  })

  it('touches an existing search in place: same id, same position, no duplicate', () => {
    const list = [
      saved({ id: 'a', q: 'diskare', seenJobIds: ['x'] }),
      saved({ id: 'b', q: 'lokalvårdare' }),
    ]
    const next = upsertSearch(
      list,
      saved({ id: 'new-id', q: ' Diskare ', seenJobIds: ['y', 'z'] }),
      2000,
    )
    expect(next).toHaveLength(2)
    expect(next[0].id).toBe('a')
    expect(next[0].seenJobIds).toEqual(['y', 'z'])
    expect(next[0].lastUsedAt).toBe(2000)
    expect(next[1]).toBe(list[1])
  })

  it('never mutates the input list', () => {
    const list = [saved({ id: 'a', q: 'diskare' })]
    upsertSearch(list, saved({ id: 'b', q: 'lokalvårdare' }), 1000)
    expect(list).toHaveLength(1)
  })

  it('evicts the least recently used search over the cap, never the new one', () => {
    const list = [
      saved({ id: 'old-but-loved', q: 'q1', lastUsedAt: 50 }),
      saved({ id: 'stale', q: 'q2', lastUsedAt: 10 }),
      saved({ id: 'recent', q: 'q3', lastUsedAt: 40 }),
    ]
    const next = upsertSearch(list, saved({ id: 'new', q: 'q4' }), 100, 3)
    expect(next.map((s) => s.id)).toEqual(['old-but-loved', 'recent', 'new'])
  })

  it('treats searches without lastUsedAt as oldest when evicting', () => {
    const list = [
      saved({ id: 'legacy', q: 'q1' }),
      saved({ id: 'used', q: 'q2', lastUsedAt: 5 }),
    ]
    const next = upsertSearch(list, saved({ id: 'new', q: 'q3' }), 100, 2)
    expect(next.map((s) => s.id)).toEqual(['used', 'new'])
  })

  it('defaults the cap to MAX_SAVED_SEARCHES', () => {
    let list: SavedSearch[] = []
    for (let i = 0; i < MAX_SAVED_SEARCHES + 3; i++) {
      list = upsertSearch(list, saved({ id: `s${i}`, q: `q${i}` }), i)
    }
    expect(list).toHaveLength(MAX_SAVED_SEARCHES)
    // The three least recently used (s0..s2) were evicted.
    expect(list[0].id).toBe('s3')
  })
})

describe('mergeSeenJobIds', () => {
  it('accumulates a union — earlier ids survive later, smaller runs', () => {
    expect(mergeSeenJobIds(['a', 'b', 'c'], ['b', 'd'])).toEqual(['a', 'b', 'c', 'd'])
  })

  it('starts from the current ids when nothing was seen', () => {
    expect(mergeSeenJobIds(undefined, ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('drops duplicates within the current run', () => {
    expect(mergeSeenJobIds([], ['a', 'a', 'b'])).toEqual(['a', 'b'])
  })

  it('caps by dropping the OLDEST ids first', () => {
    expect(mergeSeenJobIds(['a', 'b'], ['c', 'd'], 3)).toEqual(['b', 'c', 'd'])
  })

  it('defaults the cap to MAX_SEEN_JOB_IDS', () => {
    const seen = Array.from({ length: MAX_SEEN_JOB_IDS }, (_, i) => `s${i}`)
    const merged = mergeSeenJobIds(seen, ['fresh'])
    expect(merged).toHaveLength(MAX_SEEN_JOB_IDS)
    expect(merged[merged.length - 1]).toBe('fresh')
    expect(merged[0]).toBe('s1')
  })

  it('reports zero new on an unchanged market across page-size asymmetry', () => {
    // Heisenberg's exact failure: run at limit 100 (simple-apply), toggle the
    // filter, rerun at limit 25 — then toggle back. The market never changed,
    // so "new since last" must be 0 at every step.
    const market = Array.from({ length: 100 }, (_, i) => `ad${i}`)
    const bigRun = market.slice(0, 100)
    const smallRun = market.slice(0, 25)

    let seen = mergeSeenJobIds(undefined, bigRun)
    expect(newJobIds(smallRun, seen)).toHaveLength(0)
    seen = mergeSeenJobIds(seen, smallRun)
    expect(newJobIds(bigRun, seen)).toHaveLength(0)
    seen = mergeSeenJobIds(seen, bigRun)

    // One genuinely new ad appears — exactly one is reported.
    expect(newJobIds(['brand-new', ...smallRun], seen)).toEqual(['brand-new'])
  })
})

describe('mergeRestoredSearches', () => {
  const current = [saved({ id: 'a', q: 'diskare', lastUsedAt: 100 })]

  it('adds restored searches that are genuinely new', () => {
    const next = mergeRestoredSearches(current, [saved({ id: 'b', q: 'lokalvårdare' })])
    expect(next.map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('drops restored entries matching an existing id or filter identity', () => {
    const next = mergeRestoredSearches(current, [
      saved({ id: 'a', q: 'something-else' }),
      saved({ id: 'other-id', q: ' Diskare ' }),
    ])
    expect(next).toBe(current)
  })

  it('drops duplicates within the restored list itself', () => {
    const next = mergeRestoredSearches(current, [
      saved({ id: 'b', q: 'lokalvårdare' }),
      saved({ id: 'c', q: 'LOKALVÅRDARE' }),
    ])
    expect(next.map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('drops malformed entries instead of crashing', () => {
    const next = mergeRestoredSearches(current, [
      null,
      42,
      { id: 'x' },
      { id: 'y', q: 'ok', municipalityId: 'm', worktimeExtentId: null },
    ])
    expect(next).toBe(current)
  })

  it('caps the merged list, evicting restored (unused) entries first', () => {
    const inUse = [
      saved({ id: 'a', q: 'q-a', lastUsedAt: 100 }),
      saved({ id: 'b', q: 'q-b', lastUsedAt: 200 }),
    ]
    const next = mergeRestoredSearches(
      inUse,
      [saved({ id: 'r1', q: 'q-r1' }), saved({ id: 'r2', q: 'q-r2' })],
      3,
    )
    expect(next).toHaveLength(3)
    expect(next.map((s) => s.id)).toContain('a')
    expect(next.map((s) => s.id)).toContain('b')
  })
})

describe('evictOverCap', () => {
  it('returns the list untouched when within the cap', () => {
    const list = [saved({ id: 'a' })]
    expect(evictOverCap(list, 3)).toEqual(list)
  })

  it('evicts by lastUsedAt until the cap is met', () => {
    const list = [
      saved({ id: 'a', lastUsedAt: 30 }),
      saved({ id: 'b', lastUsedAt: 10 }),
      saved({ id: 'c', lastUsedAt: 20 }),
      saved({ id: 'd', lastUsedAt: 40 }),
    ]
    expect(evictOverCap(list, 2).map((s) => s.id)).toEqual(['a', 'd'])
  })
})
