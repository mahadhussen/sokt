// A saved job search: the finite set of filters, named for reuse. Pure type.
// Lives outside the AF model (not report data) but is included in GDPR export.

export interface SavedSearch {
  id: string
  name: string
  q: string
  municipalityId: string
  worktimeExtentId: string
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
