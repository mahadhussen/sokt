import { describe, expect, it } from 'vitest'
import { cleanJobTitle } from './jobTitle'

describe('cleanJobTitle', () => {
  it('lämnar en redan ren titel orörd', () => {
    expect(cleanJobTitle('Personlig assistent')).toBe('Personlig assistent')
    expect(cleanJobTitle('Lokalvårdare')).toBe('Lokalvårdare')
  })

  it('tar bort parentes och klammer', () => {
    expect(cleanJobTitle('Städare (1-4 jobb)')).toBe('Städare')
    expect(cleanJobTitle('Diskare [vikariat]')).toBe('Diskare')
  })

  it('tar bort text efter tankstreck och lodstreck', () => {
    expect(cleanJobTitle('Lokalvårdare – Halmstad')).toBe('Lokalvårdare')
    expect(cleanJobTitle('Diskare — extrajobb')).toBe('Diskare')
    expect(cleanJobTitle('Städare | heltid')).toBe('Städare')
  })

  it('tar bort utropstecken', () => {
    expect(cleanJobTitle('Diskare till kommande vinter!!')).toBe('Diskare till kommande vinter')
  })

  it('gissar ALDRIG bort ord mitt i en titel', () => {
    // En halv titel i en myndighetsrapport är värre än en lång.
    expect(cleanJobTitle('Lärare i matematik')).toBe('Lärare i matematik')
    expect(cleanJobTitle('Personlig assistent till kvinna i Halmstad')).toBe(
      'Personlig assistent till kvinna i Halmstad',
    )
  })

  it('rör inte bindestreck inuti ord', () => {
    expect(cleanJobTitle('Vård-och omsorgspersonal')).toBe('Vård-och omsorgspersonal')
  })

  it('städar blanksteg', () => {
    expect(cleanJobTitle('  Diskare   sökes  ')).toBe('Diskare sökes')
  })
})
