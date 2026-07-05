import { describe, expect, it } from 'vitest'
import type { Job, Profile } from '../model/types'
import { hasTokens, letterTokens, tailorLetter } from './tailorLetter'

const job: Job = {
  id: '1',
  title: 'Lokalvårdare',
  employer: 'Städ AB',
  municipality: 'Uppsala',
  employmentType: 'deltid',
  applicationChannel: { kind: 'email', value: 'jobb@stad.se' },
  taxonomy: { occupation: { id: 'x', label: 'Städare/Lokalvårdare' } },
  source: 'platsbanken',
  publishedAt: '2026-07-01T09:04:20',
  url: 'https://arbetsformedlingen.se/platsbanken/annonser/1',
}

const profile: Profile = {
  id: 'p1',
  firstName: 'Sara',
  lastName: 'Ahmed',
  email: 'sara@example.com',
  baseLetter: '',
  details: { telefon: '0701234567' },
}

describe('letterTokens', () => {
  it('exposes job and profile facts, including the canonical occupation', () => {
    const tokens = letterTokens({ job, profile })
    expect(tokens.tjanst).toBe('Lokalvårdare')
    expect(tokens.yrke).toBe('Städare/Lokalvårdare')
    expect(tokens.arbetsgivare).toBe('Städ AB')
    expect(tokens.ort).toBe('Uppsala')
    expect(tokens.namn).toBe('Sara Ahmed')
  })
})

describe('tailorLetter', () => {
  it('substitutes tokens when the base letter uses them, respecting the user structure', () => {
    const p = {
      ...profile,
      baseLetter: 'Hej {arbetsgivare}! Jag söker jobbet som {tjänst} i {ort}. /{namn}',
    }
    expect(tailorLetter({ job, profile: p })).toBe(
      'Hej Städ AB! Jag söker jobbet som Lokalvårdare i Uppsala. /Sara Ahmed',
    )
  })

  it('leaves unknown tokens untouched', () => {
    const p = { ...profile, baseLetter: 'Referens: {referensnummer}' }
    expect(tailorLetter({ job, profile: p })).toBe('Referens: {referensnummer}')
  })

  it('wraps a plain base letter with a greeting, opener and signature', () => {
    const p = { ...profile, baseLetter: 'Jag är noggrann och pålitlig.' }
    const letter = tailorLetter({ job, profile: p })
    expect(letter).toContain('Hej Städ AB,')
    expect(letter).toContain('tjänsten som Lokalvårdare i Uppsala')
    expect(letter).toContain('Jag är noggrann och pålitlig.')
    expect(letter).toContain('Med vänliga hälsningar,\nSara Ahmed\n0701234567\nsara@example.com')
  })

  it('handles an empty base letter without a stray blank body', () => {
    const letter = tailorLetter({ job, profile })
    expect(letter).toContain('Hej Städ AB,')
    expect(letter).not.toContain('\n\n\n')
  })
})

describe('hasTokens', () => {
  it('detects tokens deterministically (no stateful regex)', () => {
    expect(hasTokens('a {ort} b')).toBe(true)
    expect(hasTokens('a {ort} b')).toBe(true)
    expect(hasTokens('no tokens here')).toBe(false)
  })
})
