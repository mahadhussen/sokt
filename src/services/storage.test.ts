import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../model/serialization'
import type { PersistedModel } from '../model/serialization'
import { createLocalStorage, StorageReadError } from './storage'
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

describe('unreadable data', () => {
  it('throws instead of reporting empty, and keeps the raw data as a backup', async () => {
    const store = fakeStore()
    store.setItem('sokt.model.v1', '{"schemaVersion":99,"applications":[]}')
    const storage = createLocalStorage(store)

    await expect(storage.load()).rejects.toBeInstanceOf(StorageReadError)
    // The original bytes survive: a wipe would be unrecoverable.
    expect(await storage.backup()).toBe('{"schemaVersion":99,"applications":[]}')
  })

  it('backs up corrupt JSON too', async () => {
    const store = fakeStore()
    store.setItem('sokt.model.v1', '{"schemaVersion":1,"applic')
    const storage = createLocalStorage(store)

    await expect(storage.load()).rejects.toBeInstanceOf(StorageReadError)
    expect(await storage.backup()).toBe('{"schemaVersion":1,"applic')
  })

  it('keeps the FIRST backup — a later failure must not overwrite it', async () => {
    const store = fakeStore()
    store.setItem('sokt.model.v1', 'original-and-precious')
    const storage = createLocalStorage(store)
    await expect(storage.load()).rejects.toThrow()

    store.setItem('sokt.model.v1', 'later-and-worthless')
    await expect(storage.load()).rejects.toThrow()

    expect(await storage.backup()).toBe('original-and-precious')
  })

  it('reports no backup when nothing failed', async () => {
    const storage = createLocalStorage(fakeStore())
    await storage.save(model)
    expect(await storage.backup()).toBeNull()
  })

  it('clear removes the backup as well — delete must mean delete', async () => {
    const store = fakeStore()
    store.setItem('sokt.model.v1', 'trasig')
    const storage = createLocalStorage(store)
    await expect(storage.load()).rejects.toThrow()

    await storage.clear()
    expect(await storage.backup()).toBeNull()
  })
})
