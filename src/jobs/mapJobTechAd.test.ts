import { describe, expect, it } from 'vitest'
import { mapApplicationChannel, mapEmploymentType, mapJobTechAd } from './mapJobTechAd'
import type { JobTechAd } from './mapJobTechAd'

// Fixture taken from a real JobSearch response (2026-07-03), trimmed to the read fields.
const realAd: JobTechAd = {
  id: '31233932',
  headline: 'Diskare',
  employer: { name: 'Branäs Fritidscenter AB' },
  workplace_address: { municipality: 'Torsby' },
  working_hours_type: { label: 'Deltid' },
  employment_type: { label: 'Vanlig anställning' },
  application_details: {
    email: null,
    url: 'https://jobba.branas.se/jobs/7900210-diskare/applications/new?promotion=2079392-arbetsformedlingen',
  },
  webpage_url: 'https://arbetsformedlingen.se/platsbanken/annonser/31233932',
  publication_date: '2026-07-01T09:04:20',
}

describe('mapJobTechAd', () => {
  it('maps a real ad to the Job type', () => {
    expect(mapJobTechAd(realAd)).toEqual({
      id: '31233932',
      title: 'Diskare',
      employer: 'Branäs Fritidscenter AB',
      municipality: 'Torsby',
      employmentType: 'deltid',
      applicationChannel: {
        kind: 'url',
        value:
          'https://jobba.branas.se/jobs/7900210-diskare/applications/new?promotion=2079392-arbetsformedlingen',
      },
      source: 'platsbanken',
      publishedAt: '2026-07-01T09:04:20',
      url: 'https://arbetsformedlingen.se/platsbanken/annonser/31233932',
    })
  })

  it('never crashes on a sparse ad', () => {
    const job = mapJobTechAd({ id: 42 })
    expect(job.id).toBe('42')
    expect(job.employmentType).toBe('unknown')
    expect(job.applicationChannel).toEqual({ kind: 'unknown' })
    expect(job.municipality).toBe('')
  })
})

describe('mapEmploymentType', () => {
  it('maps Heltid and Deltid from working_hours_type', () => {
    expect(mapEmploymentType({ working_hours_type: { label: 'Heltid' } })).toBe('heltid')
    expect(mapEmploymentType({ working_hours_type: { label: 'Deltid' } })).toBe('deltid')
  })

  it('lets behovs-/timanställning win over working hours', () => {
    expect(
      mapEmploymentType({
        working_hours_type: { label: 'Deltid' },
        employment_type: { label: 'Behovsanställning' },
      }),
    ).toBe('timanstalld')
    expect(
      mapEmploymentType({ employment_type: { label: 'Timanställning' } }),
    ).toBe('timanstalld')
  })

  it('returns unknown when nothing matches', () => {
    expect(mapEmploymentType({})).toBe('unknown')
    expect(
      mapEmploymentType({ employment_type: { label: 'Säsongsanställning' } }),
    ).toBe('unknown')
  })
})

describe('mapApplicationChannel', () => {
  it('prefers url over email', () => {
    expect(
      mapApplicationChannel({
        application_details: { url: 'https://a.se', email: 'x@y.se' },
      }),
    ).toEqual({ kind: 'url', value: 'https://a.se' })
  })

  it('falls back to email, then unknown', () => {
    expect(
      mapApplicationChannel({ application_details: { url: null, email: 'x@y.se' } }),
    ).toEqual({ kind: 'email', value: 'x@y.se' })
    expect(mapApplicationChannel({})).toEqual({ kind: 'unknown' })
  })
})
