import { describe, expect, it } from 'vitest'
import { externalLink, mapJobLinksAd, mapJobLinksAds, sourceHost } from './mapJobLinksAd'
import type { JobLinksAd } from './mapJobLinksAd'

const externalAd: JobLinksAd = {
  id: 'abc123',
  headline: 'Diskare ',
  employer: { name: 'Restaurang AB' },
  occupation_group: { concept_id: 'Z6TY_xDf_Yup', label: 'Städare' },
  occupation_field: { concept_id: 'whao_Q6A_ScE', label: 'Sanering och renhållning' },
  workplace_addresses: [{ municipality: 'Uppsala' }],
  publication_date: '2026-07-06T00:00:00',
  source_links: [{ label: 'studentjob.se', url: 'https://www.studentjob.se/annons/1' }],
}

const afDuplicate: JobLinksAd = {
  ...externalAd,
  id: 'def456',
  source_links: [
    { label: 'arbetsformedlingen.se', url: 'https://arbetsformedlingen.se/platsbanken/annonser/1' },
  ],
}

describe('externalLink', () => {
  it('returns the board link for an external-only ad', () => {
    expect(externalLink(externalAd)).toEqual({
      label: 'studentjob.se',
      url: 'https://www.studentjob.se/annons/1',
    })
  })

  it('returns null for ads that also exist in Platsbanken (AF duplicates)', () => {
    expect(externalLink(afDuplicate)).toBeNull()
  })

  it('returns null when there is no usable link', () => {
    expect(externalLink({ ...externalAd, source_links: [] })).toBeNull()
    expect(externalLink({ ...externalAd, source_links: [{ label: 'x' }] })).toBeNull()
  })
})

describe('mapJobLinksAd', () => {
  it('maps an external ad to a Job with url channel and joblinks source', () => {
    const job = mapJobLinksAd(externalAd)
    expect(job).toMatchObject({
      id: 'joblinks:abc123',
      title: 'Diskare',
      employer: 'Restaurang AB',
      municipality: 'Uppsala',
      employmentType: 'unknown',
      applicationChannel: { kind: 'url', value: 'https://www.studentjob.se/annons/1' },
      source: 'joblinks',
      url: 'https://www.studentjob.se/annons/1',
    })
    expect(job?.taxonomy.group?.label).toBe('Städare')
  })

  it('drops AF duplicates in bulk mapping', () => {
    expect(mapJobLinksAds([externalAd, afDuplicate]).map((j) => j.id)).toEqual([
      'joblinks:abc123',
    ])
  })
})

describe('sourceHost', () => {
  it('extracts the board hostname without www', () => {
    const job = mapJobLinksAd(externalAd)
    expect(job && sourceHost(job)).toBe('studentjob.se')
  })
})
