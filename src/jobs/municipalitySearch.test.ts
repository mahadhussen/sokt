import { describe, expect, it } from 'vitest'
import {
  MAX_MUNICIPALITY_MATCHES,
  matchMunicipalities,
  municipalityById,
  resolveMunicipality,
} from './municipalitySearch'
import { MUNICIPALITIES } from './municipalities'

const names = (query: string, limit?: number) =>
  matchMunicipalities(query, limit).map((m) => m.name)

describe('matchMunicipalities', () => {
  it('prefix: "göte" ger Göteborg före Götene', () => {
    expect(names('göte')).toEqual(['Göteborg', 'Götene'])
  })

  it('diakritvikning: "goteborg" träffar Göteborg', () => {
    expect(names('goteborg')).toEqual(['Göteborg'])
  })

  it('diakritvikning: "malmo" träffar Malmö', () => {
    expect(names('malmo')).toEqual(['Malmö'])
  })

  it('versaler kvittar: "MALMÖ" träffar Malmö', () => {
    expect(names('MALMÖ')).toEqual(['Malmö'])
  })

  it('exakt före prefix och substräng: "berg" ger Berg först', () => {
    expect(names('berg')[0]).toBe('Berg')
    // Substräng-träffar följer efter, inte i stället — mätt utan taket,
    // eftersom prefixträffarna fyller de 8 synliga raderna först.
    const all = names('berg', 290)
    expect(all[0]).toBe('Berg')
    expect(all).toContain('Åtvidaberg')
  })

  it('prefix före substräng: "borg" ger Borgholm före Göteborg', () => {
    const result = names('borg')
    expect(result.indexOf('Borgholm')).toBeLessThan(result.indexOf('Göteborg'))
  })

  it('bindestreck viks: "malung salen" träffar Malung-Sälen', () => {
    expect(names('malung salen')).toEqual(['Malung-Sälen'])
  })

  it('bindestreck viks: "dals ed" träffar Dals-Ed', () => {
    expect(names('dals ed')).toEqual(['Dals-Ed'])
  })

  it('flerordsprefix: "upplands v" träffar Upplands Väsby', () => {
    expect(names('upplands v')).toEqual(['Upplands Väsby'])
  })

  it('tom och blank sökning ger inga träffar', () => {
    expect(names('')).toEqual([])
    expect(names('   ')).toEqual([])
  })

  it('felstavning utan träff ger tom lista, aldrig en gissning', () => {
    expect(names('göteborj')).toEqual([])
  })

  it('taket håller: "s" ger max 8 träffar, alla prefix', () => {
    const result = matchMunicipalities('s')
    expect(result.length).toBe(MAX_MUNICIPALITY_MATCHES)
    for (const m of result) {
      expect(m.name.toLowerCase().startsWith('s')).toBe(true)
    }
  })

  it('varje träff är en riktig kommun ur taxonomin', () => {
    for (const m of matchMunicipalities('a', 290)) {
      expect(MUNICIPALITIES.some((k) => k.id === m.id && k.name === m.name)).toBe(true)
    }
  })
})

describe('resolveMunicipality', () => {
  it('entydig vikning löser: "malmo" ⇒ Malmö', () => {
    expect(resolveMunicipality('malmo')?.name).toBe('Malmö')
  })

  it('bokstavstrogen skrivning vinner vid kollision: "habo" ⇒ Habo, "håbo" ⇒ Håbo', () => {
    expect(resolveMunicipality('habo')?.name).toBe('Habo')
    expect(resolveMunicipality('håbo')?.name).toBe('Håbo')
  })

  it('prefix löser inte: "göte" är ingen kommun', () => {
    expect(resolveMunicipality('göte')).toBeNull()
  })

  it('tomt löser inte', () => {
    expect(resolveMunicipality('')).toBeNull()
  })
})

describe('municipalityById', () => {
  it('rundtur: varje träffs id slår upp samma kommun', () => {
    const goteborg = matchMunicipalities('goteborg')[0]
    expect(municipalityById(goteborg.id)?.name).toBe('Göteborg')
  })

  it('okänt id ger null', () => {
    expect(municipalityById('finns_inte')).toBeNull()
  })
})
