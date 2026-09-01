// One store holds the model. Edits go through commands; every applied
// command persists the model through the storage port. CV binary and consent
// live outside the JSON model (IndexedDB and a localStorage flag).

import { create } from 'zustand'
import type { Job } from '../model/types'
import { SCHEMA_VERSION } from '../model/serialization'
import type { PersistedModel } from '../model/serialization'
import { createLocalStorage } from '../services/storage'
import type { StoragePort } from '../services/storage'
import { base64ToBlob, blobToBase64, createIndexedDbFileStore, CV_REF } from '../services/fileStore'
import type { CvMeta, FileStore } from '../services/fileStore'
import { BACKUP_VERSION, mergeBackup, parseBackup } from '../model/backup'
import type { BackupFile } from '../model/backup'
import { defaultAuth } from '../services/auth'
import type { Account, AuthPort } from '../services/auth'
import { createSupabaseSync } from '../services/cloudSync'
import type { CloudSync } from '../services/cloudSync'
import { getSupabase } from '../services/supabaseClient'
import { mergeRemote } from '../model/sync'
import {
  evictOverCap,
  findSavedSearch,
  savedSearchSummary,
  searchKey,
  upsertSearch,
} from '../jobs/savedSearch'
import type { SavedSearch, SearchInput } from '../jobs/savedSearch'
import { MUNICIPALITIES } from '../jobs/municipalities'
import { WORKTIME_EXTENTS } from '../jobs/filters'
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
  // An account is optional. Null means the app runs exactly as it always has:
  // everything on this device, nothing sent anywhere.
  account: Account | null
  authConfigured: boolean
  // A write to storage failed. The UI said "saved" while nothing was saved, so
  // this has to be visible — silence here is how a participant loses a month.
  saveFailed: boolean
  syncing: boolean
  syncError: string | null
  syncedAt: number | null
  // Okopplad data fanns på enheten när ett konto loggade in. Frågan ställs —
  // aldrig automatisk flytt: på en delad dator kan datan tillhöra någon annan.
  claimOffer: { apps: number; hasCv: boolean } | null
  execute(command: Command): void
  undo(): void
  setNotice(notice: Notice | null): void
  claimDeviceData(): Promise<void>
  dismissClaim(): void
  setJobs(jobs: Job[], total: number): void
  setConsent(consent: boolean): void
  setLang(lang: Lang): void
  setAiKey(key: string): void
  cacheLastSearch(entry: CachedSearch): void
  uploadCv(file: File): Promise<void>
  removeCv(): Promise<void>
  // The ONE way a search becomes (or refreshes) a tag: called after every
  // executed search. Dedupes on normalized filters, caps the list, and stores
  // the seen job ids for "new since last". Returns the tag, or null when the
  // search had no filters at all (an "everything" tag helps no one).
  recordSearch(input: SearchInput, jobIds: string[]): SavedSearch | null
  removeSearch(id: string): void
  exportBackup(): Promise<string>
  importBackup(json: string): Promise<ImportResult>
  deleteAll(): Promise<void>
  sendCode(email: string): Promise<void>
  verifyCode(email: string, code: string): Promise<void>
  signOut(): Promise<void>
  deleteAccount(): Promise<void>
  syncNow(): Promise<void>
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

export function toPersistedModel(state: ModelState): PersistedModel {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: state.profile,
    applications: state.applications,
  }
}

// UI:t (CV-nedladdning, Gmail-utkast) behöver alltid det AKTIVA kontots
// filutrymme — wrappern pekas om vid varje kontobyte.
let activeFiles: FileStore = createIndexedDbFileStore(null)
export const fileStore: FileStore = {
  saveCv: (cv) => activeFiles.saveCv(cv),
  loadCv: () => activeFiles.loadCv(),
  clearCv: () => activeFiles.clearCv(),
}

export function createSoktStore(
  storageFor: (userId: string | null) => StoragePort,
  filesFor: (userId: string | null) => FileStore,
  auth: AuthPort,
) {
  let storage = storageFor(null)
  let files = filesFor(null)
  let switchNs: (userId: string | null) => Promise<void> = async () => {}
  let offerClaim: (userId: string) => Promise<void> = async () => {}
  const store = create<SoktStore>((set, get) => {
    // Persisting must never fail silently. `save` is fire-and-forget by design
    // (an edit should not wait on disk), but a rejected write has to surface —
    // otherwise the row is on screen, the tab counter went up, and it is gone
    // on reload. A quota error is a rejected promise here, and both call sites
    // used to discard it.
    function persist(model: PersistedModel): void {
      storage.save(model).then(
        () => {
          if (get().saveFailed) set({ saveFailed: false })
        },
        () => set({ saveFailed: true }),
      )
    }

    // Mirror one edit to the account. The local write has already succeeded, so
    // a failure here is "not synced yet", not lost data — it is reported as
    // such, and the next syncNow() picks the row up from the local side.
    function mirror(run: ((cloud: CloudSync) => Promise<void>) | undefined): void {
      const { account } = get()
      if (!account || !run) return
      void getSupabase()
        .then((db) => run(createSupabaseSync(db, account.id)))
        .then(
          () => {
            if (get().syncError) set({ syncError: null })
            set({ syncedAt: Date.now() })
          },
          (e: unknown) => set({ syncError: e instanceof Error ? e.message : String(e) }),
        )
    }

    // Byt aktivt utrymme (konto eller enhetens okopplade) och läs in dess data.
    // Detta är kärnan i "väldigt personligt": inloggning byter ARBETSYTA, den
    // lägger aldrig någon annans lokala data ovanpå kontot.
    switchNs = async (userId) => {
      storage = storageFor(userId)
      files = filesFor(userId)
      activeFiles = files
      let loadError = false
      const [model, cv] = await Promise.all([
        storage.load().catch(() => {
          loadError = true
          return null
        }),
        files.loadCv().catch(() => null),
      ])
      const backupJson = loadError ? await storage.backup().catch(() => null) : null
      set({
        profile: model?.profile ?? null,
        applications: model?.applications ?? [],
        cv: cv ? { fileName: cv.fileName, text: cv.text, byteSize: cv.byteSize } : null,
        history: [],
        notice: null,
        claimOffer: null,
        loadError,
        backupJson,
        hydrated: true,
      })
    }

    // Fråga — flytta aldrig automatiskt. På en delad dator kan enhetens
    // okopplade data tillhöra någon annan än den som just loggade in.
    offerClaim = async (userId) => {
      if (window.localStorage.getItem(`sokt.claim.done.u.${userId}`)) return
      const st = get()
      if (st.applications.length > 0 || st.profile || st.cv) return
      const anonModel = await storageFor(null)
        .load()
        .catch(() => null)
      const anonCv = await filesFor(null)
        .loadCv()
        .catch(() => null)
      const apps = anonModel?.applications.length ?? 0
      if (apps === 0 && !anonModel?.profile && !anonCv) return
      set({ claimOffer: { apps, hasCv: Boolean(anonCv) } })
    }

    return {
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
      account: null,
      authConfigured: auth.configured,
      saveFailed: false,
      syncing: false,
      syncError: null,
      syncedAt: null,
      claimOffer: null,

      execute(command) {
        const { profile, applications, history } = get()
        const next = command.apply({ profile, applications })
        // Any new command invalidates a pending undo offer: the notice must never
        // outlive the command it describes.
        set({ ...next, history: [...history, command], notice: null })
        persist(toPersistedModel(next))
        mirror(command.sync)
      },

      undo() {
        const { profile, applications, history } = get()
        const command = history[history.length - 1]
        if (!command) return
        const next = command.invert({ profile, applications })
        set({ ...next, history: history.slice(0, -1), notice: null })
        persist(toPersistedModel(next))
        mirror(command.syncUndo)
      },

      setNotice(notice) {
        set({ notice })
      },

      async claimDeviceData() {
        const { account } = get()
        if (!account) return
        const anonStorage = storageFor(null)
        const anonFiles = filesFor(null)
        const anonModel = await anonStorage.load().catch(() => null)
        const anonCv = await anonFiles.loadCv().catch(() => null)
        const next = {
          profile: anonModel?.profile ?? null,
          applications: anonModel?.applications ?? [],
        }
        set({ ...next, claimOffer: null })
        await storage.save(toPersistedModel(next)).catch(() => set({ saveFailed: true }))
        if (anonCv) {
          await files.saveCv(anonCv).catch(() => undefined)
          set({ cv: { fileName: anonCv.fileName, text: anonCv.text, byteSize: anonCv.byteSize } })
        }
        // FLYTT, inte kopia: låg datan kvar okopplad skulle nästa konto på
        // samma dator erbjudas samma persons uppgifter.
        await anonStorage.clear().catch(() => undefined)
        await anonFiles.clearCv().catch(() => undefined)
        window.localStorage.setItem(`sokt.claim.done.u.${account.id}`, '1')
        await get().syncNow()
      },

      dismissClaim() {
        const { account } = get()
        if (account) window.localStorage.setItem(`sokt.claim.done.u.${account.id}`, '1')
        set({ claimOffer: null })
      },

      async sendCode(email) {
        await auth.sendCode(email)
      },

      async verifyCode(email, code) {
        const account = await auth.verifyCode(email, code)
        set({ account })
        // Inloggning byter till KONTOTS utrymme. Enhetens okopplade data följer
        // aldrig med automatiskt — den erbjuds via claim-frågan. Det var exakt
        // så en persons CV och profil hamnade synliga i någon annans inloggning.
        await switchNs(account.id)
        await offerClaim(account.id)
        await get().syncNow()
      },

      async signOut() {
        await auth.signOut()
        // Tillbaka till enhetens okopplade utrymme — kontots data lämnar skärmen.
        set({ account: null, syncError: null, syncedAt: null })
        await switchNs(null)
      },

      async deleteAccount() {
        // Ta bort CV:t ur bucketen först — auth-CASCADE når inte storage-objekt,
        // så annars blir filen kvar föräldralös.
        const acc = get().account
        if (acc) {
          await createSupabaseSync(await getSupabase(), acc.id)
            .removeCvFile()
            .catch(() => undefined)
        }
        await auth.deleteAccount()
        // Kontot och allt som låg i det är borta. Det som ligger på den här
        // enheten är deltagarens eget och rörs inte — det raderas separat med
        // "Radera all data", och kontopanelen säger det rakt ut.
        set({ account: null, syncError: null, syncedAt: null })
        await switchNs(null)
      },

      async syncNow() {
        const { account, profile, applications, cv } = get()
        if (!account) return
        set({ syncing: true, syncError: null })
        try {
          const cloud = createSupabaseSync(await getSupabase(), account.id)
          const remote = await cloud.pull()
          const merged = mergeRemote({ profile, applications }, remote)
          const nextModel = { profile: merged.profile, applications: merged.applications }
          set({ ...nextModel })
          persist(toPersistedModel(nextModel))
          // Push what only this device had. Uploading one row at a time means a
          // single failure costs that row, not the batch.
          for (const application of merged.toUpload) {
            await cloud.upsertApplication(application)
          }
          if (merged.profile && !remote.profile) await cloud.saveProfile(merged.profile)

          // CV:t: ingen lokalt men kontot har ett → hämta hem (ny enhet). Ett
          // lokalt men molnet saknar → ladda upp (nyss inloggad/claim-flytt).
          if (!cv && remote.cvMeta) {
            const stored = await cloud.downloadCvFile()
            if (stored) {
              await files.saveCv(stored)
              set({
                cv: { fileName: stored.fileName, text: stored.text, byteSize: stored.byteSize },
              })
              const p = get().profile
              if (p && p.cvFileRef !== CV_REF) {
                get().execute(setProfileCommand({ ...p, cvFileRef: CV_REF }))
              }
            }
          } else if (cv && !remote.cvMeta) {
            const local = await files.loadCv()
            if (local) await cloud.uploadCvFile(local)
          }
          set({ syncedAt: Date.now() })
        } catch (e) {
          set({ syncError: e instanceof Error ? e.message : String(e) })
        } finally {
          set({ syncing: false })
        }
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
        const stored = { ...meta, blob: file }
        await files.saveCv(stored)
        set({ cv: meta })
        const { profile, account } = get()
        if (profile && profile.cvFileRef !== CV_REF) {
          get().execute(setProfileCommand({ ...profile, cvFileRef: CV_REF }))
        }
        // Inloggad → CV:t följer kontot. Molnfel = "inte synkat än", aldrig
        // blockerande: den lokala kopian finns kvar och nästa synk laddar upp.
        if (account) {
          try {
            await createSupabaseSync(await getSupabase(), account.id).uploadCvFile(stored)
            set({ syncedAt: Date.now(), syncError: null })
          } catch (e) {
            set({ syncError: e instanceof Error ? e.message : String(e) })
          }
        }
      },

      async removeCv() {
        await files.clearCv()
        set({ cv: null })
        const { profile, account } = get()
        if (profile?.cvFileRef) {
          get().execute(setProfileCommand({ ...profile, cvFileRef: undefined }))
        }
        if (account) {
          try {
            await createSupabaseSync(await getSupabase(), account.id).removeCvFile()
          } catch (e) {
            set({ syncError: e instanceof Error ? e.message : String(e) })
          }
        }
      },

      recordSearch(input, jobIds) {
        const q = input.q.trim()
        if (!q && !input.municipalityId && !input.worktimeExtentId) return null
        const prev = get().savedSearches
        const existing = findSavedSearch(prev, input)
        const record: SavedSearch = {
          id: existing?.id ?? crypto.randomUUID(),
          // A name the participant gave the search (old manual flow) survives;
          // auto-created tags are named from their filters.
          name:
            existing?.name ??
            savedSearchSummary(
              { q, municipalityId: input.municipalityId, worktimeExtentId: input.worktimeExtentId },
              (id) => MUNICIPALITIES.find((m) => m.id === id)?.name,
              (id) => WORKTIME_EXTENTS.find((w) => w.id === id)?.label,
            ),
          q,
          municipalityId: input.municipalityId,
          worktimeExtentId: input.worktimeExtentId,
          seenJobIds: jobIds,
        }
        const savedSearches = upsertSearch(prev, record, Date.now())
        set({ savedSearches })
        persistSavedSearches(savedSearches)
        return record
      },

      removeSearch(id) {
        const savedSearches = get().savedSearches.filter((s) => s.id !== id)
        set({ savedSearches })
        persistSavedSearches(savedSearches)
      },

      async exportBackup() {
        const { profile, applications, savedSearches } = get()
        // The CV blob travels with the file. The old export named itself "all
        // your data" while leaving the CV behind, so a restore left the
        // participant re-uploading a document they thought they had saved.
        // The AI key is deliberately absent: it is a secret, not their data.
        const stored = await files.loadCv().catch(() => null)
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
          await files.saveCv({
            ...meta,
            blob: base64ToBlob(backup.cv.dataBase64),
          })
          set({ cv: meta })
          cvRestored = true
        }

        const nextModel = {
          profile: merged.profile,
          applications: merged.applications,
        }
        // A restore is not undoable through the command history — it is a bulk
        // write, and offering "Ångra" for it would be a lie.
        set({ ...nextModel, history: [], notice: null })
        await storage.save(toPersistedModel(nextModel))

        // Merge saved searches by id AND by filter identity: the same search
        // re-created on this device (new id) must not become a second chip.
        const current = get().savedSearches
        const knownIds = new Set(current.map((s) => s.id))
        const knownKeys = new Set(current.map((s) => searchKey(s)))
        const restoredSearches = (backup.savedSearches as SavedSearch[]).filter((s) => {
          if (
            !s ||
            typeof s.id !== 'string' ||
            typeof s.q !== 'string' ||
            typeof s.municipalityId !== 'string' ||
            typeof s.worktimeExtentId !== 'string'
          ) {
            return false
          }
          const key = searchKey(s)
          if (knownIds.has(s.id) || knownKeys.has(key)) return false
          knownKeys.add(key)
          return true
        })
        if (restoredSearches.length > 0) {
          const savedSearches = evictOverCap([...current, ...restoredSearches])
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
        await files.clearCv()
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
    }
  })

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
    // Enhetsglobala saker (samtycke, sparade sökningar) läses en gång.
    store.setState({
      consent: window.localStorage.getItem(CONSENT_KEY) === 'true',
      savedSearches: loadSavedSearches(),
    })
    // Sedan avgör sessionen vilket UTRYMME som visas: kontots eller enhetens.
    // Den som är inloggad ser sitt — aldrig det som råkar ligga på datorn.
    const account = await auth.currentAccount().catch(() => null)
    if (account) {
      store.setState({ account })
      await switchNs(account.id)
      await offerClaim(account.id)
      void store.getState().syncNow()
    } else {
      await switchNs(null)
    }
  }
  void boot()

  return store
}

export const useSoktStore = createSoktStore(
  (userId) => createLocalStorage(window.localStorage, userId),
  (userId) => createIndexedDbFileStore(userId),
  defaultAuth(),
)
