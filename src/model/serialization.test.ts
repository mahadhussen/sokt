import { describe, expect, it } from 'vitest'
import type { Application, Profile } from './types'
import { deserializeModel, emptyModel, serializeModel, SCHEMA_VERSION } from './serialization'

const profile: Profile = {
  id: 'p1',
  firstName: 'Sara',
  lastName: 'Ahmed',
  email: 'sara@example.com',
  baseLetter: 'Hej, jag söker tjänsten...',
  details: { telefon: '0701234567' },
}

const application: Application = {
  id: 'a1',
  jobTitle: 'Lokalvårdare',
  employerName: 'Carolines städservice',
  employmentType: 'deltid',
  appliedAt: '2026-07-03',
  surveyAnswered: false,
  municipality: 'Uppsala',
  channel: 'email:jobb@carolines.se',
  jobUrl: 'https://arbetsformedlingen.se/platsbanken/annonser/31239556',
  status: 'sent',
}

describe('model serialization', () => {
  it('round trips the empty model exactly', () => {
    const model = emptyModel()
    expect(deserializeModel(serializeModel(model))).toEqual(model)
  })

  it('round trips a populated model exactly', () => {
    const model = {
      schemaVersion: SCHEMA_VERSION,
      profile,
      applications: [application],
    }
    expect(deserializeModel(serializeModel(model))).toEqual(model)
  })

  it('rejects an unknown schema version', () => {
    expect(() => deserializeModel('{"schemaVersion":99,"applications":[]}')).toThrow(
      /schemaversion/i,
    )
  })

  it('rejects json that is not a model', () => {
    expect(() => deserializeModel('"hej"')).toThrow()
    expect(() => deserializeModel('{"schemaVersion":1}')).toThrow(/applications/)
  })
})
