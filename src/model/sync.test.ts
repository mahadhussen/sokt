import { describe, expect, it } from 'vitest'
import { mergeRemote } from './sync'
import type { Application, Profile } from './types'

const app = (id: string, over: Partial<Application> = {}): Application => ({
  id,
  jobTitle: 'Lokalvårdare',
  employerName: 'Rena Ytor AB',
  employmentType: 'deltid',
  appliedAt: '2026-07-14',
  surveyAnswered: false,
  municipality: 'Göteborg',
  channel: 'manual',
  status: 'sent',
  ...over,
})

const profile = (id: string): Profile => ({
  id,
  firstName: 'Amina',
  lastName: 'Yusuf',
  email: 'amina@example.se',
  baseLetter: '',
  details: {},
})

const remote = (over: Partial<Parameters<typeof mergeRemote>[1]> = {}) => ({
  profile: null,
  applications: [],
  deletedIds: [],
  ...over,
})

describe('mergeRemote', () => {
  it('uploads what only this device has — a month offline must not cost a month', () => {
    const result = mergeRemote({ profile: null, applications: [app('a1'), app('a2')] }, remote())
    expect(result.toUpload.map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(result.applications.map((a) => a.id)).toEqual(['a1', 'a2'])
  })

  it('brings down what only the account has — the broken phone case', () => {
    const result = mergeRemote(
      { profile: null, applications: [] },
      remote({ applications: [app('a1'), app('a2')] }),
    )
    expect(result.applications.map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(result.addedFromAccount).toBe(2)
    expect(result.toUpload).toEqual([])
  })

  it('unions both sides without duplicating the overlap', () => {
    const result = mergeRemote(
      { profile: null, applications: [app('shared'), app('local-only')] },
      remote({ applications: [app('shared'), app('remote-only')] }),
    )
    expect(result.applications.map((a) => a.id)).toEqual([
      'shared',
      'local-only',
      'remote-only',
    ])
    expect(result.toUpload.map((a) => a.id)).toEqual(['local-only'])
  })

  it('honours a delete made on another device', () => {
    const result = mergeRemote(
      { profile: null, applications: [app('a1'), app('gone')] },
      remote({ deletedIds: ['gone'] }),
    )
    expect(result.applications.map((a) => a.id)).toEqual(['a1'])
    expect(result.removedAsDeleted).toBe(1)
  })

  it('never re-uploads a row the account deleted', () => {
    // Otherwise the row comes straight back and cannot be deleted anywhere.
    const result = mergeRemote(
      { profile: null, applications: [app('gone')] },
      remote({ deletedIds: ['gone'] }),
    )
    expect(result.toUpload).toEqual([])
    expect(result.applications).toEqual([])
  })

  it('keeps the local copy of a row both sides have', () => {
    const mine = app('shared', { municipality: 'Malmö' })
    const theirs = app('shared', { municipality: 'Göteborg' })
    const result = mergeRemote(
      { profile: null, applications: [mine] },
      remote({ applications: [theirs] }),
    )
    expect(result.applications).toEqual([mine])
  })

  it('takes the account profile only when this device has none', () => {
    expect(mergeRemote({ profile: null, applications: [] }, remote({ profile: profile('p9') })).profile)
      .toEqual(profile('p9'))
    expect(
      mergeRemote(
        { profile: profile('mine'), applications: [] },
        remote({ profile: profile('p9') }),
      ).profile,
    ).toEqual(profile('mine'))
  })

  it('is a no-op when both sides already agree', () => {
    const result = mergeRemote(
      { profile: null, applications: [app('a1')] },
      remote({ applications: [app('a1')] }),
    )
    expect(result.toUpload).toEqual([])
    expect(result.addedFromAccount).toBe(0)
    expect(result.removedAsDeleted).toBe(0)
  })
})
