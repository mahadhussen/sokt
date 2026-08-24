import { describe, expect, it } from 'vitest'
import { buildManualApplication, validateManualApply } from './buildManualApplication'
import type { ManualApplyInput } from './buildManualApplication'
import { activityReport } from '../report/activityReport'

const complete: ManualApplyInput = {
  id: 'm1',
  jobTitle: 'Lokalvårdare',
  employerName: 'Rena Ytor AB',
  employmentType: 'deltid',
  appliedAt: '2026-07-14',
  surveyAnswered: true,
  municipality: 'Göteborg',
}

describe('validateManualApply', () => {
  it('accepts a complete application', () => {
    expect(validateManualApply(complete)).toEqual([])
  })

  it('names every missing field, in form order', () => {
    expect(
      validateManualApply({
        id: 'm2',
        jobTitle: '',
        employerName: '',
        employmentType: '',
        appliedAt: '',
        surveyAnswered: false,
        municipality: '',
      }),
    ).toEqual(['jobTitle', 'employerName', 'employmentType', 'appliedAt', 'municipality'])
  })

  it('treats whitespace as missing', () => {
    expect(validateManualApply({ ...complete, jobTitle: '   ' })).toEqual(['jobTitle'])
    expect(validateManualApply({ ...complete, municipality: ' ' })).toEqual(['municipality'])
  })

  it('rejects a date that is not a real ISO day', () => {
    expect(validateManualApply({ ...complete, appliedAt: '2026-7-14' })).toEqual(['appliedAt'])
    expect(validateManualApply({ ...complete, appliedAt: '14/7/2026' })).toEqual(['appliedAt'])
    expect(validateManualApply({ ...complete, appliedAt: '2026-13-01' })).toEqual(['appliedAt'])
  })
})

describe('buildManualApplication', () => {
  it('builds the record from exactly what the user typed', () => {
    expect(buildManualApplication(complete)).toEqual({
      id: 'm1',
      jobTitle: 'Lokalvårdare',
      employerName: 'Rena Ytor AB',
      employmentType: 'deltid',
      appliedAt: '2026-07-14',
      surveyAnswered: true,
      municipality: 'Göteborg',
      channel: 'manual',
      jobUrl: undefined,
      status: 'sent',
    })
  })

  it('trims the text fields', () => {
    const app = buildManualApplication({
      ...complete,
      jobTitle: '  Diskare  ',
      employerName: ' Kvarnen HB ',
      municipality: ' Torsby ',
    })
    expect(app.jobTitle).toBe('Diskare')
    expect(app.employerName).toBe('Kvarnen HB')
    expect(app.municipality).toBe('Torsby')
  })

  it('keeps a link when there is one, and drops an empty one', () => {
    expect(buildManualApplication({ ...complete, jobUrl: 'https://a.se/jobb' }).jobUrl).toBe(
      'https://a.se/jobb',
    )
    expect(buildManualApplication({ ...complete, jobUrl: '   ' }).jobUrl).toBeUndefined()
  })

  it('refuses to invent a value for an incomplete record', () => {
    // The report goes to Arbetsförmedlingen. Guessing here would put a made-up
    // employer or employment type into a government document.
    expect(() => buildManualApplication({ ...complete, employmentType: '' })).toThrow(
      /employmentType/,
    )
    expect(() => buildManualApplication({ ...complete, employerName: '' })).toThrow(
      /employerName/,
    )
  })

  it('lands in the activity report exactly like an application made in Sökt', () => {
    const rows = activityReport([buildManualApplication(complete)], '2026-07-01', '2026-07-31')
    expect(rows).toEqual([
      {
        jobTitle: 'Lokalvårdare',
        employerName: 'Rena Ytor AB',
        employmentType: 'deltid',
        appliedAt: '2026-07-14',
        surveyAnswered: true,
        municipality: 'Göteborg',
      },
    ])
  })
})
