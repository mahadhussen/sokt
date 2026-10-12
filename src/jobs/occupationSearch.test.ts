import { describe, expect, it } from 'vitest'
import { editDistance, searchOccupations } from './occupationSearch'

const names = (q: string) => searchOccupations(q).map((m) => m.name)

describe('searchOccupations', () => {
  it('tom query ger inga förslag', () => {
    expect(searchOccupations('')).toEqual([])
    expect(searchOccupations('   ')).toEqual([])
  })

  it('prefix rankas före delsträng', () => {
    const r = names('stad')
    expect(r[0]).toBe('städare')
    expect(r).toContain('hotellstädare')
    expect(r.indexOf('städare')).toBeLessThan(r.indexOf('hotellstädare'))
  })

  it('tangentbord utan å ä ö fungerar', () => {
    // Hela modulens existensberättigande: API:t viker inte diakriter.
    expect(names('lokalvardare')).toContain('lokalvårdare')
    expect(names('underskoterska')).toContain('undersköterska')
  })

  it('stavfel förlåts', () => {
    expect(names('lokalvardre')).toContain('lokalvårdare')
    expect(names('sjukskoterskaa')).toContain('sjuksköterska')
  })

  it('okänt sammansatt ord hittar rätt yrkesfamilj via ordstammen', () => {
    // "matbiträdare" är inget yrke, men den som skriver så menar ett
    // biträdesyrke — att svara "inget" vore värdelöst.
    const r = names('matbiträdare')
    expect(r).toContain('köksbiträde')
    expect(r.length).toBeGreaterThan(1)
  })

  it('rena nonsensord ger inga förslag', () => {
    expect(searchOccupations('qzxwvy')).toEqual([])
  })

  it('samma query ger alltid samma ordning', () => {
    expect(names('bitrade')).toEqual(names('bitrade'))
  })

  it('taket respekteras', () => {
    expect(searchOccupations('a', 3).length).toBeLessThanOrEqual(3)
  })
})

describe('editDistance', () => {
  it('räknar rätt och kapar vid taket', () => {
    expect(editDistance('abc', 'abc')).toBe(0)
    expect(editDistance('abc', 'abd')).toBe(1)
    expect(editDistance('abc', 'xyz', 2)).toBeGreaterThan(2)
    // Längdskillnad större än taket avbryts direkt.
    expect(editDistance('a', 'abcdef', 2)).toBeGreaterThan(2)
  })
})

describe('ordstammen får inte vara en böjningsändelse', () => {
  it('matbiträdare föreslår biträdesyrken, inte städare', () => {
    // Vid stamkrav 5 matchade "-adare" och städare rankades FÖRST — en
    // generisk ändelse är ingen yrkeslikhet.
    const r = searchOccupations('matbiträdare').map((m) => m.name)
    expect(r[0]).toBe('köksbiträde')
    expect(r).not.toContain('städare')
    expect(r).not.toContain('hotellstädare')
  })
})
