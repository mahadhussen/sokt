import { describe, expect, it } from 'vitest'
import {
  MAX_SAVED_SEARCHES,
  evictOverCap,
  findSavedSearch,
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
