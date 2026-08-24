import { describe, expect, it } from 'vitest'
import { BACKUP_VERSION, mergeBackup, parseBackup } from './backup'
import type { BackupFile } from './backup'
import type { Application, Profile } from './types'

const application = (over: Partial<Application> = {}): Application => ({
  id: 'a1',
  jobTitle: 'Diskare',
  employerName: 'Kvarnen HB',
  employmentType: 'deltid',
  appliedAt: '2026-07-03',
  surveyAnswered: false,
  municipality: 'Torsby',
  channel: 'manual',
  status: 'sent',
  ...over,
})

const profile: Profile = {
  id: 'p1',
  firstName: 'Amina',
  lastName: 'Yusuf',
  email: 'amina@example.com',
  baseLetter: 'Hej!',
  details: { ort: 'Göteborg' },
}

const file = (over: Partial<BackupFile> = {}): string =>
  JSON.stringify({
    sokt: 'backup',
    version: BACKUP_VERSION,
    exportedAt: '2026-07-28T10:00:00.000Z',
    profile,
    applications: [application()],
    savedSearches: [],
    ...over,
  })

describe('parseBackup', () => {
  it('round trips a backup written by this version', () => {
    const { backup, droppedApplications } = parseBackup(file())
    expect(droppedApplications).toBe(0)
    expect(backup.profile).toEqual(profile)
    expect(backup.applications).toEqual([application()])
  })

  it('keeps the CV when the file carries one', () => {
    const withCv = file({
      cv: { fileName: 'cv.pdf', text: 'Amina', byteSize: 1234, dataBase64: 'JVBERi0=' },
    })
    expect(parseBackup(withCv).backup.cv?.fileName).toBe('cv.pdf')
  })

  it('salvages the readable rows and reports the rest', () => {
    const half = file({
      applications: [application(), null, { id: 'x' }, application({ id: 'a2' })] as never,
    })
    const { backup, droppedApplications } = parseBackup(half)
    expect(backup.applications.map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(droppedApplications).toBe(2)
  })

  it('refuses anything that is not a Sökt backup, with a reason', () => {
    expect(() => parseBackup('inte json')).toThrow(/JSON/)
    expect(() => parseBackup('null')).toThrow(/säkerhetskopia/)
    expect(() => parseBackup(JSON.stringify({ hello: 'world' }))).toThrow(/från Sökt/)
  })

  it('refuses a backup from a newer version rather than half-reading it', () => {
    expect(() => parseBackup(file({ version: BACKUP_VERSION + 1 }))).toThrow(/nyare version/)
  })

  it('drops an unreadable profile instead of restoring garbage', () => {
    expect(parseBackup(file({ profile: { firstName: 'x' } as never })).backup.profile).toBeNull()
  })
})

describe('mergeBackup', () => {
  const backup = parseBackup(file({ applications: [application(), application({ id: 'a2' })] }))
    .backup

  it('adds only what is missing, keyed by id', () => {
    const result = mergeBackup({ profile: null, applications: [application()] }, backup)
    expect(result.applications.map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(result.addedApplications).toBe(1)
  })

  it('never removes what the device already had', () => {
    const local = application({ id: 'local-only' })
    const result = mergeBackup({ profile: null, applications: [local] }, backup)
    expect(result.applications.map((a) => a.id)).toEqual(['local-only', 'a1', 'a2'])
  })

  it('keeps the profile already on the device', () => {
    const mine: Profile = { ...profile, id: 'p2', firstName: 'Mahad' }
    expect(mergeBackup({ profile: mine, applications: [] }, backup).profile).toEqual(mine)
  })

  it('takes the profile from the file when the device has none', () => {
    expect(mergeBackup({ profile: null, applications: [] }, backup).profile).toEqual(profile)
  })
})
