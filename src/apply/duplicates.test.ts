import { describe, expect, it } from 'vitest'
import { appliedTo, findDuplicate } from './duplicates'
import type { Application, Job } from '../model/types'

function application(over: Partial<Application> = {}): Application {
  return {
    id: 'a1',
    jobTitle: 'Lokalvårdare',
    employerName: 'Rena Ytor AB',
    employmentType: 'deltid',
    appliedAt: '2026-07-14',
    surveyAnswered: false,
    municipality: 'Göteborg',
    channel: 'email:jobb@rena.se',
    jobUrl: 'https://arbetsformedlingen.se/platsbanken/annonser/1',
    status: 'sent',
    ...over,
  }
}

function job(over: Partial<Job> = {}): Job {
  return {
    id: '1',
    title: 'Lokalvårdare',
    employer: 'Rena Ytor AB',
    municipality: 'Göteborg',
    employmentType: 'deltid',
    applicationChannel: { kind: 'email', value: 'jobb@rena.se' },
    taxonomy: {},
    source: 'platsbanken',
    publishedAt: '2026-07-01',
    url: 'https://arbetsformedlingen.se/platsbanken/annonser/1',
    ...over,
  }
}

describe('appliedTo', () => {
  it('finds the application by ad url', () => {
    expect(appliedTo([application()], job())?.id).toBe('a1')
  })

  it('finds it by employer and title when the ad was re-published under a new url', () => {
    const republished = job({ id: '2', url: 'https://arbetsformedlingen.se/platsbanken/annonser/2' })
    expect(appliedTo([application()], republished)?.id).toBe('a1')
  })

  it('matches across the two sources and across spelling', () => {
    // The same ad arrives from Platsbanken and from JobAd Links with different
    // ids, different urls, and inconsistent casing.
    const viaLinks = job({
      id: 'jl-9',
      title: 'lokalvardare',
      employer: 'rena ytor ab',
      source: 'joblinks',
      url: 'https://ledigajobb.se/annons/9',
    })
    expect(appliedTo([application()], viaLinks)?.id).toBe('a1')
  })

  it('is null for a job that has not been applied to', () => {
    const other = job({
      employer: 'Annat Städ AB',
      url: 'https://arbetsformedlingen.se/platsbanken/annonser/77',
    })
    expect(appliedTo([application()], other)).toBeNull()
    expect(appliedTo([], job())).toBeNull()
  })

  it('trusts the ad url over the employer name', () => {
    // Same ad, employer written differently by the two sources. The url is the
    // stronger signal and must win.
    const sameAdOtherName = job({ employer: 'Rena Ytor Aktiebolag' })
    expect(appliedTo([application()], sameAdOtherName)?.id).toBe('a1')
  })

  it('does not match on a missing url through an empty string', () => {
    const noUrl = job({ url: '', employer: 'Okänd AB', title: 'Okänt' })
    expect(appliedTo([application({ jobUrl: undefined })], noUrl)).toBeNull()
  })
})

describe('findDuplicate', () => {
  const existing = [application()]

  it('catches the same ad url', () => {
    expect(
      findDuplicate(existing, {
        jobTitle: 'Något annat',
        employerName: 'Något annat AB',
        appliedAt: '2026-07-20',
        jobUrl: 'https://arbetsformedlingen.se/platsbanken/annonser/1',
      })?.id,
    ).toBe('a1')
  })

  it('catches the same employer and role within the window', () => {
    expect(
      findDuplicate(existing, {
        jobTitle: 'Lokalvårdare',
        employerName: 'Rena Ytor AB',
        appliedAt: '2026-07-20',
      })?.id,
    ).toBe('a1')
  })

  it('allows the same job again after the window — that is a real second try', () => {
    expect(
      findDuplicate(existing, {
        jobTitle: 'Lokalvårdare',
        employerName: 'Rena Ytor AB',
        appliedAt: '2026-11-20',
      }),
    ).toBeNull()
  })

  it('does not flag a different role at the same employer', () => {
    expect(
      findDuplicate(existing, {
        jobTitle: 'Vaktmästare',
        employerName: 'Rena Ytor AB',
        appliedAt: '2026-07-20',
      }),
    ).toBeNull()
  })

  it('survives a malformed stored date instead of guessing', () => {
    const broken = [application({ appliedAt: 'inte-ett-datum' })]
    expect(
      findDuplicate(broken, {
        jobTitle: 'Lokalvårdare',
        employerName: 'Rena Ytor AB',
        appliedAt: '2026-07-20',
      }),
    ).toBeNull()
  })
})
