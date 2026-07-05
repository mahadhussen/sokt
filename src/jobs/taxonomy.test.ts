import { describe, expect, it } from 'vitest'
import { canonicalOccupation, mapTaxonomy } from './taxonomy'

describe('mapTaxonomy', () => {
  it('reads occupation, group and field concepts', () => {
    expect(
      mapTaxonomy({
        occupation: { concept_id: 'dYo1_D8c_87U', label: 'Städare/Lokalvårdare' },
        occupation_group: { concept_id: 'Z6TY_xDf_Yup', label: 'Städare' },
        occupation_field: { concept_id: 'whao_Q6A_ScE', label: 'Sanering och renhållning' },
      }),
    ).toEqual({
      occupation: { id: 'dYo1_D8c_87U', label: 'Städare/Lokalvårdare' },
      group: { id: 'Z6TY_xDf_Yup', label: 'Städare' },
      field: { id: 'whao_Q6A_ScE', label: 'Sanering och renhållning' },
    })
  })

  it('drops concepts missing an id or a label, never crashes on a sparse ad', () => {
    expect(mapTaxonomy({})).toEqual({ occupation: undefined, group: undefined, field: undefined })
    expect(mapTaxonomy({ occupation: { concept_id: 'x' } }).occupation).toBeUndefined()
    expect(mapTaxonomy({ occupation: { label: 'Städare' } }).occupation).toBeUndefined()
  })
})

describe('canonicalOccupation', () => {
  it('prefers the most specific occupation, then group, then the headline', () => {
    expect(
      canonicalOccupation(
        { occupation: { id: '1', label: 'Städare/Lokalvårdare' }, group: { id: '2', label: 'Städare' } },
        'Lokalvårdare sökes!',
      ),
    ).toBe('Städare/Lokalvårdare')
    expect(
      canonicalOccupation({ group: { id: '2', label: 'Städare' } }, 'Lokalvårdare sökes!'),
    ).toBe('Städare')
    expect(canonicalOccupation({}, 'Lokalvårdare sökes!')).toBe('Lokalvårdare sökes!')
  })
})
