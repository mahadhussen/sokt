// Persistence edge. The model round trips through a StoragePort.
//
// M0 uses a localStorage adapter. Supabase (auth + database + encrypted CV
// storage) slots in behind the same port in M1 — see WORKLOG.md for the
// decision.

import type { PersistedModel } from '../model/serialization'
import { deserializeModel, serializeModel } from '../model/serialization'

export interface StoragePort {
  load(): Promise<PersistedModel | null>
  save(model: PersistedModel): Promise<void>
  clear(): Promise<void>
}

// The subset of the Web Storage API we need; injectable for tests.
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const STORAGE_KEY = 'sokt.model.v1'

export function createLocalStorage(store: KeyValueStore): StoragePort {
  return {
    async load() {
      const json = store.getItem(STORAGE_KEY)
      return json === null ? null : deserializeModel(json)
    },
    async save(model) {
      store.setItem(STORAGE_KEY, serializeModel(model))
    },
    async clear() {
      store.removeItem(STORAGE_KEY)
    },
  }
}
