// One store holds the model. Edits go through commands; every applied
// command persists the model through the storage port. CV binary and consent
// live outside the JSON model (IndexedDB and a localStorage flag).

import { create } from 'zustand'
import type { Job } from '../model/types'
import { SCHEMA_VERSION } from '../model/serialization'
import type { PersistedModel } from '../model/serialization'
import { createLocalStorage } from '../services/storage'
import type { StoragePort } from '../services/storage'
import { createIndexedDbFileStore, CV_REF } from '../services/fileStore'
import type { CvMeta, FileStore } from '../services/fileStore'
import type { SavedSearch } from '../jobs/savedSearch'
import type { Lang } from '../i18n/translations'
import type { Command, ModelState } from './commands'
import { setProfileCommand } from './commands'

const CONSENT_KEY = 'sokt.consent.v1'
const SEARCHES_KEY = 'sokt.searches.v1'
const LANG_KEY = 'sokt.lang.v1'

function loadLang(): Lang {
  const stored = window.localStorage.getItem(LANG_KEY)
  return stored === 'ar' || stored === 'so' ? stored : 'sv'
}

export interface SoktStore extends ModelState {
  hydrated: boolean
  consent: boolean
  history: Command[]
  jobs: Job[]
  jobsTotal: number
  cv: CvMeta | null
  savedSearches: SavedSearch[]
  lang: Lang
  execute(command: Command): void
  undo(): void
  hydrate(
    model: PersistedModel | null,
    cv: CvMeta | null,
    consent: boolean,
    savedSearches: SavedSearch[],
  ): void
  setJobs(jobs: Job[], total: number): void
  setConsent(consent: boolean): void
  setLang(lang: Lang): void
  uploadCv(file: File): Promise<void>
  removeCv(): Promise<void>
  saveSearch(input: Omit<SavedSearch, 'id'>): void
  removeSearch(id: string): void
  markSearchSeen(id: string, jobIds: string[]): void
  exportData(): string
  deleteAll(): Promise<void>
}

function loadSavedSearches(): SavedSearch[] {
  try {
    const raw = window.localStorage.getItem(SEARCHES_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as SavedSearch[]) : []
  } catch {
    return []
  }
}

function persistSavedSearches(searches: SavedSearch[]): void {
  window.localStorage.setItem(SEARCHES_KEY, JSON.stringify(searches))
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

export function createSoktStore(storage: StoragePort, fileStore: FileStore) {
  const store = create<SoktStore>((set, get) => ({
    profile: null,
    applications: [],
    hydrated: false,
    consent: false,
    history: [],
    jobs: [],
    jobsTotal: 0,
    cv: null,
    savedSearches: [],
    lang: loadLang(),

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

    hydrate(model, cv, consent, savedSearches) {
      set({
        profile: model?.profile ?? null,
        applications: model?.applications ?? [],
        cv,
        consent,
        savedSearches,
        hydrated: true,
      })
    },

    setJobs(jobs, total) {
      set({ jobs, jobsTotal: total })
    },

    setConsent(consent) {
      set({ consent })
      if (consent) window.localStorage.setItem(CONSENT_KEY, 'true')
      else window.localStorage.removeItem(CONSENT_KEY)
    },

    setLang(lang) {
      set({ lang })
      window.localStorage.setItem(LANG_KEY, lang)
    },

    async uploadCv(file) {
      // pdfjs is large; load it only when a CV is actually uploaded.
      const { extractPdfText } = await import('../services/cvParser')
      const text = await extractPdfText(file).catch(() => '')
      const meta: CvMeta = { fileName: file.name, text, byteSize: file.size }
      await fileStore.saveCv({ ...meta, blob: file })
      set({ cv: meta })
      const { profile } = get()
      if (profile && profile.cvFileRef !== CV_REF) {
        get().execute(setProfileCommand({ ...profile, cvFileRef: CV_REF }))
      }
    },

    async removeCv() {
      await fileStore.clearCv()
      set({ cv: null })
      const { profile } = get()
      if (profile?.cvFileRef) {
        get().execute(setProfileCommand({ ...profile, cvFileRef: undefined }))
      }
    },

    saveSearch(input) {
      const search: SavedSearch = { id: crypto.randomUUID(), ...input }
      const savedSearches = [...get().savedSearches, search]
      set({ savedSearches })
      persistSavedSearches(savedSearches)
    },

    removeSearch(id) {
      const savedSearches = get().savedSearches.filter((s) => s.id !== id)
      set({ savedSearches })
      persistSavedSearches(savedSearches)
    },

    markSearchSeen(id, jobIds) {
      const savedSearches = get().savedSearches.map((s) =>
        s.id === id ? { ...s, seenJobIds: jobIds } : s,
      )
      set({ savedSearches })
      persistSavedSearches(savedSearches)
    },

    exportData() {
      const { profile, applications, cv, savedSearches } = get()
      return JSON.stringify(
        { schemaVersion: SCHEMA_VERSION, profile, applications, cv, savedSearches },
        null,
        2,
      )
    },

    async deleteAll() {
      await storage.clear()
      await fileStore.clearCv()
      window.localStorage.removeItem(CONSENT_KEY)
      window.localStorage.removeItem(SEARCHES_KEY)
      set({
        profile: null,
        applications: [],
        cv: null,
        consent: false,
        savedSearches: [],
        history: [],
      })
    },
  }))

  async function boot() {
    const [model, cv] = await Promise.all([
      storage.load().catch(() => null),
      fileStore.loadCv().catch(() => null),
    ])
    const consent = window.localStorage.getItem(CONSENT_KEY) === 'true'
    const cvMeta: CvMeta | null = cv
      ? { fileName: cv.fileName, text: cv.text, byteSize: cv.byteSize }
      : null
    store.getState().hydrate(model, cvMeta, consent, loadSavedSearches())
  }
  void boot()

  return store
}

export const fileStore = createIndexedDbFileStore()
export const useSoktStore = createSoktStore(defaultStorage(), fileStore)
