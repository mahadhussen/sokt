// One store holds the model. Edits go through commands; every applied
// command persists the model through the storage port. CV binary and consent
// live outside the JSON model (IndexedDB and a localStorage flag).

import { create } from 'zustand'
import type { Job } from '../model/types'
import { SCHEMA_VERSION } from '../model/serialization'
import type { PersistedModel } from '../model/serialization'
import { createLocalStorage } from '../services/storage'
import type { StoragePort } from '../services/storage'
import {
  base64ToBlob,
  blobToBase64,
  createIndexedDbFileStore,
  CV_REF,
} from '../services/fileStore'
import type { CvMeta, FileStore } from '../services/fileStore'
import { BACKUP_VERSION, mergeBackup, parseBackup } from '../model/backup'
import type { BackupFile } from '../model/backup'
import type { SavedSearch } from '../jobs/savedSearch'
import type { CachedSearch } from '../jobs/freshness'
import type { Lang } from '../i18n/translations'
import type { Command, ModelState } from './commands'
import { setProfileCommand } from './commands'

const CONSENT_KEY = 'sokt.consent.v1'
const SEARCHES_KEY = 'sokt.searches.v1'
const LANG_KEY = 'sokt.lang.v1'
const AI_KEY = 'sokt.aikey.v1'
const LASTSEARCH_KEY = 'sokt.lastsearch.v1'

function loadLastSearch(): CachedSearch | null {
  try {
    const raw = window.localStorage.getItem(LASTSEARCH_KEY)
    return raw ? (JSON.parse(raw) as CachedSearch) : null
  } catch {
    return null
  }
}

function loadLang(): Lang {
  const stored = window.localStorage.getItem(LANG_KEY)
  return stored === 'ar' || stored === 'so' ? stored : 'sv'
}

// A short confirmation of what just happened. `undoable` means the command that
// produced it is still the last one in history, so undo() will reverse exactly
// that — the moment anything else is executed the notice is cleared.
export interface Notice {
  key: string
  undoable: boolean
}

export interface SoktStore extends ModelState {
  hydrated: boolean
  // Stored data existed but could not be read. The app runs on an empty model,
  // and the original bytes are kept under a backup key — never overwritten.
  loadError: boolean
  backupJson: string | null
  consent: boolean
  history: Command[]
  jobs: Job[]
  jobsTotal: number
  cv: CvMeta | null
  savedSearches: SavedSearch[]
  lang: Lang
  aiKey: string
  lastSearch: CachedSearch | null
  notice: Notice | null
  execute(command: Command): void
  undo(): void
  setNotice(notice: Notice | null): void
  hydrate(input: {
    model: PersistedModel | null
    cv: CvMeta | null
    consent: boolean
    savedSearches: SavedSearch[]
    loadError?: boolean
    backupJson?: string | null
  }): void
  setJobs(jobs: Job[], total: number): void
  setConsent(consent: boolean): void
  setLang(lang: Lang): void
  setAiKey(key: string): void
  cacheLastSearch(entry: CachedSearch): void
  uploadCv(file: File): Promise<void>
  removeCv(): Promise<void>
  saveSearch(input: Omit<SavedSearch, 'id'>): void
  removeSearch(id: string): void
  markSearchSeen(id: string, jobIds: string[]): void
  exportBackup(): Promise<string>
  importBackup(json: string): Promise<ImportResult>
  deleteAll(): Promise<void>
}

export interface ImportResult {
  addedApplications: number
  droppedApplications: number
  cvRestored: boolean
  profileRestored: boolean
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
    loadError: false,
    backupJson: null,
    consent: false,
    history: [],
    jobs: [],
    jobsTotal: 0,
    cv: null,
    savedSearches: [],
    lang: loadLang(),
    aiKey: window.localStorage.getItem(AI_KEY) ?? '',
    lastSearch: loadLastSearch(),
    notice: null,

    execute(command) {
      const { profile, applications, history } = get()
      const next = command.apply({ profile, applications })
      // Any new command invalidates a pending undo offer: the notice must never
      // outlive the command it describes.
      set({ ...next, history: [...history, command], notice: null })
      void storage.save(toPersistedModel(next))
    },

    undo() {
      const { profile, applications, history } = get()
      const command = history[history.length - 1]
      if (!command) return
      const next = command.invert({ profile, applications })
      set({ ...next, history: history.slice(0, -1), notice: null })
      void storage.save(toPersistedModel(next))
    },

    setNotice(notice) {
      set({ notice })
    },

    hydrate({ model, cv, consent, savedSearches, loadError = false, backupJson = null }) {
      set({
        profile: model?.profile ?? null,
        applications: model?.applications ?? [],
        cv,
        consent,
        savedSearches,
        loadError,
        backupJson,
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

    setAiKey(key) {
      set({ aiKey: key })
      // A secret: stored locally only, never included in the data export.
      if (key.trim()) window.localStorage.setItem(AI_KEY, key)
      else window.localStorage.removeItem(AI_KEY)
    },

    cacheLastSearch(entry) {
      set({ lastSearch: entry })
      window.localStorage.setItem(LASTSEARCH_KEY, JSON.stringify(entry))
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

    async exportBackup() {
      const { profile, applications, savedSearches } = get()
      // The CV blob travels with the file. The old export named itself "all
      // your data" while leaving the CV behind, so a restore left the
      // participant re-uploading a document they thought they had saved.
      // The AI key is deliberately absent: it is a secret, not their data.
      const stored = await fileStore.loadCv().catch(() => null)
      const cv = stored
        ? {
            fileName: stored.fileName,
            text: stored.text,
            byteSize: stored.byteSize,
            dataBase64: await blobToBase64(stored.blob),
          }
        : undefined
      const backup: BackupFile = {
        sokt: 'backup',
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        profile,
        applications,
        savedSearches,
        cv,
      }
      return JSON.stringify(backup, null, 2)
    },

    async importBackup(json) {
      // Restoring never destroys: applications merge by id, an existing profile
      // wins, and a CV already on the device is left alone.
      const { backup, droppedApplications } = parseBackup(json)
      const { profile, applications } = get()
      const merged = mergeBackup({ profile, applications }, backup)

      let cvRestored = false
      if (backup.cv && !get().cv) {
        const meta: CvMeta = {
          fileName: backup.cv.fileName,
          text: backup.cv.text,
          byteSize: backup.cv.byteSize,
        }
        await fileStore.saveCv({ ...meta, blob: base64ToBlob(backup.cv.dataBase64) })
        set({ cv: meta })
        cvRestored = true
      }

      const nextModel = { profile: merged.profile, applications: merged.applications }
      // A restore is not undoable through the command history — it is a bulk
      // write, and offering "Ångra" for it would be a lie.
      set({ ...nextModel, history: [], notice: null })
      await storage.save(toPersistedModel(nextModel))

      const known = new Set(get().savedSearches.map((s) => s.id))
      const restoredSearches = (backup.savedSearches as SavedSearch[]).filter(
        (s) => s && typeof s.id === 'string' && !known.has(s.id),
      )
      if (restoredSearches.length > 0) {
        const savedSearches = [...get().savedSearches, ...restoredSearches]
        set({ savedSearches })
        persistSavedSearches(savedSearches)
      }

      return {
        addedApplications: merged.addedApplications,
        droppedApplications,
        cvRestored,
        profileRestored: profile === null && merged.profile !== null,
      }
    },

    async deleteAll() {
      await storage.clear()
      await fileStore.clearCv()
      window.localStorage.removeItem(CONSENT_KEY)
      window.localStorage.removeItem(SEARCHES_KEY)
      window.localStorage.removeItem(AI_KEY)
      window.localStorage.removeItem(LASTSEARCH_KEY)
      set({
        profile: null,
        applications: [],
        cv: null,
        consent: false,
        savedSearches: [],
        aiKey: '',
        lastSearch: null,
        history: [],
        loadError: false,
        backupJson: null,
        notice: null,
      })
    },
  }))

  // Ask the browser to keep this origin's data. Without it Safari's ITP clears
  // everything after seven days without a visit — and a jobseeker is job
  // hunting, not app-checking. Best effort: never block boot, never surface a
  // failure the participant cannot act on.
  function requestPersistence(): void {
    try {
      void navigator.storage?.persist?.().catch(() => false)
    } catch {
      /* not supported here */
    }
  }

  async function boot() {
    requestPersistence()
    // A failed load is NOT an empty model. Distinguishing the two is the whole
    // point: treating "unreadable" as "empty" would let the next edit write
    // over a participant's entire application history. The adapter has already
    // set the raw bytes aside; we surface that so the UI can say so and offer
    // the file back.
    let loadError = false
    const [model, cv] = await Promise.all([
      storage.load().catch(() => {
        loadError = true
        return null
      }),
      fileStore.loadCv().catch(() => null),
    ])
    const backupJson = loadError ? await storage.backup().catch(() => null) : null
    const consent = window.localStorage.getItem(CONSENT_KEY) === 'true'
    const cvMeta: CvMeta | null = cv
      ? { fileName: cv.fileName, text: cv.text, byteSize: cv.byteSize }
      : null
    store.getState().hydrate({
      model,
      cv: cvMeta,
      consent,
      savedSearches: loadSavedSearches(),
      loadError,
      backupJson,
    })
  }
  void boot()

  return store
}

export const fileStore = createIndexedDbFileStore()
export const useSoktStore = createSoktStore(defaultStorage(), fileStore)
