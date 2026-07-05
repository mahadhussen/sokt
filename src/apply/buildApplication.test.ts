import { describe, expect, it } from 'vitest'
import type { Job } from '../model/types'
import { buildApplication, channelString } from './buildApplication'

const job: Job = {
  id: '31233932',
  title: 'Diskare',
  employer: 'Branäs Fritidscenter AB',
  municipality: 'Torsby',
  employmentType: 'deltid',
  applicationChannel: { kind: 'url', value: 'https://jobba.branas.se/jobs/7900210' },
  taxonomy: { occupation: { id: 'dYo1_D8c_87U', label: 'Diskare' } },
  source: 'platsbanken',
  publishedAt: '2026-07-01T09:04:20',
  url: 'https://arbetsformedlingen.se/platsbanken/annonser/31233932',
}

describe('buildApplication', () => {
  it('captures all six AF fields deterministically from the job and the user input', () => {
    const a = buildApplication(job, {
      id: 'a1',
      appliedAt: '2026-07-03',
      surveyAnswered: true,
    })
    expect(a).toEqual({
      id: 'a1',
      jobTitle: 'Diskare',
      employerName: 'Branäs Fritidscenter AB',
      employmentType: 'deltid',
      appliedAt: '2026-07-03',
      surveyAnswered: true,
      municipality: 'Torsby',
      channel: 'url:https://jobba.branas.se/jobs/7900210',
      jobUrl: 'https://arbetsformedlingen.se/platsbanken/annonser/31233932',
      status: 'sent',
    })
  })

  it('requires an explicit employment type when the ad is unknown', () => {
    const unknownJob = { ...job, employmentType: 'unknown' as const }
    expect(() =>
      buildApplication(unknownJob, { id: 'a1', appliedAt: '2026-07-03', surveyAnswered: false }),
    ).toThrow(/Anställningsform/)
    const a = buildApplication(unknownJob, {
      id: 'a1',
      appliedAt: '2026-07-03',
      surveyAnswered: false,
      employmentType: 'heltid',
    })
    expect(a.employmentType).toBe('heltid')
  })

  it('requires a municipality when the ad has none', () => {
    const noOrt = { ...job, municipality: '' }
    expect(() =>
      buildApplication(noOrt, { id: 'a1', appliedAt: '2026-07-03', surveyAnswered: false }),
    ).toThrow(/Ort saknas/)
    const a = buildApplication(noOrt, {
      id: 'a1',
      appliedAt: '2026-07-03',
      surveyAnswered: false,
      municipality: 'Uppsala',
    })
    expect(a.municipality).toBe('Uppsala')
  })

  it('rejects a non-ISO date', () => {
    expect(() =>
      buildApplication(job, { id: 'a1', appliedAt: '3/7/2026', surveyAnswered: false }),
    ).toThrow(/Ogiltigt datum/)
  })
})

describe('channelString', () => {
  it('encodes url, email and unknown', () => {
    expect(channelString({ kind: 'url', value: 'https://a.se' })).toBe('url:https://a.se')
    expect(channelString({ kind: 'email', value: 'x@y.se' })).toBe('email:x@y.se')
    expect(channelString({ kind: 'unknown' })).toBe('unknown')
  })
})
