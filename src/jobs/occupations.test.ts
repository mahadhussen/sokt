import { describe, expect, it } from 'vitest'
import { COMMON_OCCUPATIONS, fold, hasSwedishDiacritics, suggestOccupation } from './occupations'

describe('fold', () => {
  it('strips Swedish diacritics and case', () => {
    expect(fold('Undersköterska')).toBe('underskoterska')
    expect(fold('STÄDARE')).toBe('stadare')
    expect(fold('Lokalvårdare')).toBe('lokalvardare')
  })

  it('trims and collapses whitespace', () => {
    expect(fold('  personlig   assistent ')).toBe('personlig assistent')
  })
})

describe('hasSwedishDiacritics', () => {
  it('detects å ä ö in both cases', () => {
    expect(hasSwedishDiacritics('städare')).toBe(true)
    expect(hasSwedishDiacritics('Ödesmark')).toBe(true)
    expect(hasSwedishDiacritics('stadare')).toBe(false)
  })
})

describe('suggestOccupation', () => {
  it('recovers the spellings that return zero hits from the API', () => {
    // These three are the live-verified dead ends: 0 hits folded, hundreds
    // of hits spelled with å/ä/ö.
    expect(suggestOccupation('underskoterska')).toBe('undersköterska')
    expect(suggestOccupation('stadare')).toBe('städare')
    expect(suggestOccupation('lokalvardare')).toBe('lokalvårdare')
  })

  it('is case insensitive and tolerates surrounding space', () => {
    expect(suggestOccupation(' Underskoterska ')).toBe('undersköterska')
  })

  it('matches on a prefix', () => {
    expect(suggestOccupation('malar')).toBe('målare')
    expect(suggestOccupation('sjukskoter')).toBe('sjuksköterska')
  })

  it('says nothing when the query already has diacritics', () => {
    expect(suggestOccupation('städare')).toBeNull()
    expect(suggestOccupation('undersköterska')).toBeNull()
  })

  it('says nothing when the query is already the right spelling', () => {
    expect(suggestOccupation('diskare')).toBeNull()
    expect(suggestOccupation('kock')).toBeNull()
  })

  it('says nothing for an unknown or empty query', () => {
    expect(suggestOccupation('zzzzq')).toBeNull()
    expect(suggestOccupation('')).toBeNull()
    expect(suggestOccupation('   ')).toBeNull()
  })
})

describe('COMMON_OCCUPATIONS', () => {
  it('has no duplicates, folded', () => {
    const folded = COMMON_OCCUPATIONS.map(fold)
    expect(new Set(folded).size).toBe(folded.length)
  })

  it('is stored lowercase so the picker can render it consistently', () => {
    for (const name of COMMON_OCCUPATIONS) {
      expect(name).toBe(name.toLowerCase())
    }
  })
})
