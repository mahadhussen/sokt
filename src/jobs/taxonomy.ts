// JobTech occupation taxonomy mapping. Pure module — no ui/services/app.
//
// The ad already carries taxonomy concepts (occupation, occupation_group,
// occupation_field). This module reads them into JobTaxonomy and derives a
// canonical occupation title, most specific first. Deterministic and tested.

import type { JobTaxonomy, TaxonomyRef } from '../model/types'

interface RawConcept {
  concept_id?: string | null
  label?: string | null
}

export interface TaxonomyAd {
  occupation?: RawConcept | null
  occupation_group?: RawConcept | null
  occupation_field?: RawConcept | null
}

function ref(concept: RawConcept | null | undefined): TaxonomyRef | undefined {
  if (!concept?.concept_id || !concept.label) return undefined
  return { id: concept.concept_id, label: concept.label }
}

export function mapTaxonomy(ad: TaxonomyAd): JobTaxonomy {
  return {
    occupation: ref(ad.occupation),
    group: ref(ad.occupation_group),
    field: ref(ad.occupation_field),
  }
}

// The best canonical occupation label, most specific first. Falls back to the
// ad's free-text headline when the taxonomy carries nothing.
export function canonicalOccupation(taxonomy: JobTaxonomy, fallbackTitle: string): string {
  return taxonomy.occupation?.label ?? taxonomy.group?.label ?? fallbackTitle
}
