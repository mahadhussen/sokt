import { describe, expect, it } from 'vitest'
import { mapApplicationChannel, mapContact, mapEmploymentType, mapJobTechAd } from './mapJobTechAd'
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
  occupation: { concept_id: 'dYo1_D8c_87U', label: 'Diskare' },
  occupation_group: { concept_id: 'abc_group', label: 'Köks- och restaurangbiträden' },
  occupation_field: { concept_id: 'def_field', label: 'Hotell, restaurang, storhushåll' },
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
      taxonomy: {
        occupation: { id: 'dYo1_D8c_87U', label: 'Diskare' },
        group: { id: 'abc_group', label: 'Köks- och restaurangbiträden' },
        field: { id: 'def_field', label: 'Hotell, restaurang, storhushåll' },
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

  it('omits contact and supportMentions entirely when the ad has none', () => {
    const job = mapJobTechAd(realAd)
    expect('contact' in job).toBe(false)
    expect('supportMentions' in job).toBe(false)
  })

  it('derives supportMentions from headline and description text', () => {
    const job = mapJobTechAd({
      ...realAd,
      headline: 'Diskare — Nystartsjobb välkommet',
      description: { text: 'Om ni har Introduktionsjobb eller lönebidrag, skriv det i mailet.' },
    })
    expect(job.supportMentions).toEqual(['nystartsjobb', 'introduktionsjobb', 'lonebidrag'])
  })
})

describe('mapContact', () => {
  // Fixture verbatim from a real JobSearch response (ad 31436583, 2026-09-08):
  // the hiring manager first, the union section second. The role lives in
  // contact_type; description was null in every measured contact.
  const realContacts: JobTechAd = {
    application_contacts: [
      {
        name: 'Paula Norqvist',
        description: null,
        email: null,
        telephone: '054-5409920',
        contact_type: 'Enhetschef',
      },
      {
        name: 'Kommunal sektion Karlstad',
        description: null,
        email: null,
        telephone: '010-4429245',
        contact_type: null,
      },
    ],
  }

  it('maps the real ad to name, title and telephone', () => {
    expect(mapContact(realContacts)).toEqual({
      name: 'Paula Norqvist',
      title: 'Enhetschef',
      telephone: '054-5409920',
    })
  })

  it('prefers the hiring manager over a union rep even when the union is listed first', () => {
    const reversed: JobTechAd = {
      application_contacts: [...(realContacts.application_contacts ?? [])].reverse(),
    }
    expect(mapContact(reversed)?.name).toBe('Paula Norqvist')
  })

  it('skips a facklig contact without a role in favor of a plain one', () => {
    expect(
      mapContact({
        application_contacts: [
          { name: 'Fackliga företrädare nås via växeln', telephone: '010-1112233' },
          { name: 'Johan Andersson', telephone: '070-1234567' },
        ],
      })?.name,
    ).toBe('Johan Andersson')
  })

  it('still returns the union number when it is the only one — a number beats none', () => {
    expect(
      mapContact({
        application_contacts: [{ name: 'Kommunal sektion Karlstad', telephone: '010-4429245' }],
      }),
    ).toEqual({ name: 'Kommunal sektion Karlstad', title: '', telephone: '010-4429245' })
  })

  it('returns undefined when no contact left a number', () => {
    expect(mapContact({})).toBeUndefined()
    expect(
      mapContact({ application_contacts: [{ name: 'Anna', email: 'a@b.se', telephone: '  ' }, null] }),
    ).toBeUndefined()
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
  it('prefers email over url — the ad offers both, the user can only do one', () => {
    // Measured live: 4 in 100 lokalvårdare ads carry both. Reading url first
    // excluded every one of them from "enkel ansökan" even though a plain mail
    // was on offer.
    expect(
      mapApplicationChannel({
        application_details: { url: 'https://a.se', email: 'x@y.se' },
      }),
    ).toEqual({ kind: 'email', value: 'x@y.se' })
  })

  it('falls back to url, then unknown', () => {
    expect(
      mapApplicationChannel({ application_details: { url: 'https://a.se', email: null } }),
    ).toEqual({ kind: 'url', value: 'https://a.se' })
    expect(mapApplicationChannel({})).toEqual({ kind: 'unknown' })
  })
})
