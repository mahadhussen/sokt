// Persistence edge. The model round trips through a StoragePort.
//
// M0 uses a localStorage adapter. Supabase (auth + database + encrypted CV
// storage) slots in behind the same port in M1 — see WORKLOG.md for the
// decision.

import type { PersistedModel } from '../model/serialization'
import { deserializeModel, serializeModel } from '../model/serialization'

// Thrown when stored data exists but cannot be read (corrupt JSON, or a schema
// version this build does not understand). The caller must treat it as
// "unknown", never as "empty" — see the backup rule below.
export class StorageReadError extends Error {
  readonly hasBackup: boolean
  constructor(message: string, hasBackup: boolean) {
    super(message)
    this.name = 'StorageReadError'
    this.hasBackup = hasBackup
  }
}

export interface StoragePort {
  load(): Promise<PersistedModel | null>
  save(model: PersistedModel): Promise<void>
  clear(): Promise<void>
  // The raw JSON set aside by a failed load, if any. Lets the UI hand a
  // participant their unreadable data instead of pretending it never existed.
  backup(): Promise<string | null>
}

// The subset of the Web Storage API we need; injectable for tests.
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const STORAGE_KEY = 'sokt.model.v1'
const BACKUP_KEY = 'sokt.model.v1.trasig'

export function createLocalStorage(store: KeyValueStore): StoragePort {
  return {
    async load() {
      const json = store.getItem(STORAGE_KEY)
      if (json === null) return null
      try {
        return deserializeModel(json)
      } catch (cause) {
        // NEVER let unreadable data be silently overwritten. The app carries on
        // with an empty model, and the very next edit would write over the
        // original — a participant's whole application history — so we set the
        // raw string aside first. The first backup wins: a later failure must
        // not overwrite the copy made when the data was still intact.
        let hasBackup = true
        try {
          if (store.getItem(BACKUP_KEY) === null) store.setItem(BACKUP_KEY, json)
        } catch {
          hasBackup = false
        }
        throw new StorageReadError(
          cause instanceof Error ? cause.message : String(cause),
          hasBackup,
        )
      }
    },
    async save(model) {
      store.setItem(STORAGE_KEY, serializeModel(model))
    },
    async clear() {
      store.removeItem(STORAGE_KEY)
      store.removeItem(BACKUP_KEY)
    },
    async backup() {
      return store.getItem(BACKUP_KEY)
    },
  }
}
