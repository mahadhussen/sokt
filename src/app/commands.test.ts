import { describe, expect, it } from 'vitest'
import type { Application, Profile } from '../model/types'
import { addApplicationCommand, setProfileCommand } from './commands'
import type { ModelState } from './commands'

const profile: Profile = {
  id: 'p1',
  firstName: 'Sara',
  lastName: 'Ahmed',
  email: 'sara@example.com',
  baseLetter: '',
  details: {},
}

const application: Application = {
  id: 'a1',
  jobTitle: 'Diskare',
  employerName: 'Branäs Fritidscenter AB',
  employmentType: 'deltid',
  appliedAt: '2026-07-03',
  surveyAnswered: false,
  municipality: 'Torsby',
  channel: 'unknown',
  status: 'sent',
}

const empty: ModelState = { profile: null, applications: [] }

describe('commands', () => {
  it('setProfile applies and inverts', () => {
    const cmd = setProfileCommand(profile)
    const next = cmd.apply(empty)
    expect(next.profile).toEqual(profile)
    expect(cmd.invert(next)).toEqual(empty)
  })

  it('addApplication applies and inverts', () => {
    const cmd = addApplicationCommand(application)
    const next = cmd.apply(empty)
    expect(next.applications).toEqual([application])
    expect(cmd.invert(next)).toEqual(empty)
  })

  it('commands never mutate the previous state', () => {
    const before: ModelState = { profile: null, applications: [] }
    addApplicationCommand(application).apply(before)
    expect(before.applications).toEqual([])
  })
})
