// One store holds the model. Edits go through commands; every applied
// command persists the model through the storage port.

import { create } from 'zustand'
import type { Job } from '../model/types'
import { SCHEMA_VERSION } from '../model/serialization'
import type { PersistedModel } from '../model/serialization'
import { createLocalStorage } from '../services/storage'
import type { StoragePort } from '../services/storage'
import type { Command, ModelState } from './commands'

export interface SoktStore extends ModelState {
  hydrated: boolean
  history: Command[]
  jobs: Job[]
  jobsTotal: number
  execute(command: Command): void
  undo(): void
  hydrate(model: PersistedModel | null): void
  setJobs(jobs: Job[], total: number): void
}

function defaultStorage(): StoragePort {
  return createLocalStorage(window.localStorage)
}

export function toPersistedModel(state: ModelState): PersistedModel {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: state.profile,
    applications: state.applications,
  }
}

export function createSoktStore(storage: StoragePort) {
  const store = create<SoktStore>((set, get) => ({
    profile: null,
    applications: [],
    hydrated: false,
    history: [],
    jobs: [],
    jobsTotal: 0,

    execute(command) {
      const { profile, applications, history } = get()
      const next = command.apply({ profile, applications })
      set({ ...next, history: [...history, command] })
      void storage.save(toPersistedModel(next))
    },

    undo() {
      const { profile, applications, history } = get()
      const command = history[history.length - 1]
      if (!command) return
      const next = command.invert({ profile, applications })
      set({ ...next, history: history.slice(0, -1) })
      void storage.save(toPersistedModel(next))
    },

    hydrate(model) {
      set({
        profile: model?.profile ?? null,
        applications: model?.applications ?? [],
        hydrated: true,
      })
    },

    setJobs(jobs, total) {
      set({ jobs, jobsTotal: total })
    },
  }))

  void storage
    .load()
    .then((model) => store.getState().hydrate(model))
    .catch(() => store.getState().hydrate(null))

  return store
}

export const useSoktStore = createSoktStore(defaultStorage())
