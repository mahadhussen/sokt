import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../model/serialization'
import type { PersistedModel } from '../model/serialization'
import { createLocalStorage } from './storage'
import type { KeyValueStore } from './storage'

function fakeStore(): KeyValueStore {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

const model: PersistedModel = {
  schemaVersion: SCHEMA_VERSION,
  profile: {
    id: 'p1',
    firstName: 'Sara',
    lastName: 'Ahmed',
    email: 'sara@example.com',
    baseLetter: 'Hej!',
    details: {},
  },
  applications: [
    {
      id: 'a1',
      jobTitle: 'Diskare',
      employerName: 'Branäs Fritidscenter AB',
      employmentType: 'deltid',
      appliedAt: '2026-07-03',
      surveyAnswered: false,
      municipality: 'Torsby',
      channel: 'url:https://jobba.branas.se',
      status: 'sent',
    },
  ],
}

describe('local storage adapter', () => {
  it('round trips the persisted model exactly', async () => {
    const storage = createLocalStorage(fakeStore())
    await storage.save(model)
    expect(await storage.load()).toEqual(model)
  })

  it('returns null when nothing is stored, and null again after clear', async () => {
    const storage = createLocalStorage(fakeStore())
    expect(await storage.load()).toBeNull()
    await storage.save(model)
    await storage.clear()
    expect(await storage.load()).toBeNull()
  })
})
