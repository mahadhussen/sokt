// A saved job search: the finite set of filters, named for reuse. Pure type.
// Lives outside the AF model (not report data) but is included in GDPR export.

export interface SavedSearch {
  id: string
  name: string
  q: string
  municipalityId: string
  worktimeExtentId: string
  seenJobIds?: string[] // ids seen the last time this search was run
  lastUsedAt?: number // epoch ms; absent on searches saved before auto-tagging
}

// The target group should never retype a search: every executed search becomes
// a tag automatically. The list must stay short and jump-free, so:
//   - same filters = same tag (touched in place, never duplicated)
//   - new tags append at the end (chips keep their positions)
//   - over the cap, the least recently USED tag is evicted — never the one
//     the participant taps every day just because it was created first.
export const MAX_SAVED_SEARCHES = 10

export interface SearchInput {
  q: string
  municipalityId: string
  worktimeExtentId: string
}

// Identity of a search: what you typed (case/space-insensitive) plus the two
// filters. "Diskare " and "diskare" are the same tag.
export function searchKey(input: SearchInput): string {
  return [input.q.trim().toLowerCase(), input.municipalityId, input.worktimeExtentId].join('\u0000')
}

export function findSavedSearch(list: SavedSearch[], input: SearchInput): SavedSearch | undefined {
  const key = searchKey(input)
  return list.find((s) => searchKey(s) === key)
}

// Evict least-recently-used entries until the list fits. Entries without a
// lastUsedAt (saved before auto-tagging) count as oldest. Ties evict the
// earliest-positioned entry, deterministically.
export function evictOverCap(list: SavedSearch[], max = MAX_SAVED_SEARCHES): SavedSearch[] {
  const next = [...list]
  while (next.length > max) {
    let lru = 0
    for (let i = 1; i < next.length; i++) {
      if ((next[i].lastUsedAt ?? 0) < (next[lru].lastUsedAt ?? 0)) lru = i
    }
    next.splice(lru, 1)
  }
  return next
}

// Add or touch one search. An existing tag keeps its id and position; a new
// one appends and the list is capped. `now` is injected so the logic stays
// deterministic and testable.
export function upsertSearch(
  list: SavedSearch[],
  candidate: SavedSearch,
  now: number,
  max = MAX_SAVED_SEARCHES,
): SavedSearch[] {
  const key = searchKey(candidate)
  const existing = list.find((s) => searchKey(s) === key)
  if (existing) {
    return list.map((s) =>
      s === existing ? { ...candidate, id: existing.id, lastUsedAt: now } : s,
    )
  }
  return evictOverCap([...list, { ...candidate, lastUsedAt: now }], max)
}

// Job ids present now that were not in the previously seen set. This is the
// local, backend-free "alert": how many new ads since you last ran the search.
export function newJobIds(currentIds: string[], seenIds: string[] = []): string[] {
  const seen = new Set(seenIds)
  return currentIds.filter((id) => !seen.has(id))
}

// Merge searches restored from a backup into the current list. Dedupe on id
// AND on filter identity (the same search re-created on this device has a new
// id but must not become a second chip), drop malformed entries, and cap the
// result.
export function mergeRestoredSearches(
  current: SavedSearch[],
  restored: unknown[],
  max = MAX_SAVED_SEARCHES,
): SavedSearch[] {
  const knownIds = new Set(current.map((s) => s.id))
  const knownKeys = new Set(current.map((s) => searchKey(s)))
  const added: SavedSearch[] = []
  for (const item of restored) {
    const s = item as SavedSearch
    if (
      !s ||
      typeof s.id !== 'string' ||
      typeof s.q !== 'string' ||
      typeof s.municipalityId !== 'string' ||
      typeof s.worktimeExtentId !== 'string'
    ) {
      continue
    }
    const key = searchKey(s)
    if (knownIds.has(s.id) || knownKeys.has(key)) continue
    knownIds.add(s.id)
    knownKeys.add(key)
    added.push(s)
  }
  if (added.length === 0) return current
  // Overflow evicts by lastUsedAt as usual — restored entries without one
  // count as oldest, so what is in use on this device survives first.
  return evictOverCap([...current, ...added], max)
}

// A short human label for a saved search, from its filters.
export function savedSearchSummary(
  search: Pick<SavedSearch, 'q' | 'municipalityId' | 'worktimeExtentId'>,
  municipalityName: (id: string) => string | undefined,
  worktimeName: (id: string) => string | undefined,
): string {
  const parts = [
    search.q,
    search.municipalityId ? municipalityName(search.municipalityId) : undefined,
    search.worktimeExtentId ? worktimeName(search.worktimeExtentId) : undefined,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Alla jobb'
}
