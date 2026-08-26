// Cloud copy of a participant's own data, for their own devices.
//
// Local storage stays the source of truth for the session: everything works
// offline and without an account, exactly as before. When signed in, each edit
// is mirrored to Supabase as a single row, and on sign-in the two sides are
// merged. Nothing here is shared with anyone — one account, one participant's
// own applications.
//
// Writes are per entity, never a whole-model rewrite. The old
// `save(entireModel)` was last-write-wins and fire-and-forget: with two devices
// (or two tabs) the second write would silently erase the first one's work.

import type { Application, Profile } from '../model/types'
import { isApplication } from '../model/validate'
import type { StoredCv } from './cvBytes'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface RemoteState {
  profile: Profile | null
  applications: Application[]
  // Ids the server considers deleted. Without this a delete on one device is
  // resurrected by the next sync from another — the row is simply absent, which
  // is indistinguishable from "not uploaded yet".
  deletedIds: string[]
  // Whether the account has a CV in cloud storage, and its labels — so a fresh
  // device knows to download it. Filnamn/text kommer från profiles-raden.
  cvMeta: { fileName: string; text: string; byteSize: number } | null
}

export interface CloudSync {
  pull(): Promise<RemoteState>
  upsertApplication(application: Application): Promise<void>
  deleteApplication(id: string): Promise<void>
  saveProfile(profile: Profile): Promise<void>
  uploadCvFile(cv: StoredCv): Promise<void>
  downloadCvFile(): Promise<StoredCv | null>
  removeCvFile(): Promise<void>
  // Signerad nedladdningslänk till CV:t, för att läggas i ansökningsmejlet.
  // null när inget CV finns i molnet.
  createCvLink(expiresInSeconds: number): Promise<string | null>
}

const CV_BUCKET = 'cvs'
const cvPath = (userId: string) => `${userId}/cv`

interface Row {
  id: string
  job_title: string
  employer_name: string
  employment_type: string
  applied_at: string
  survey_answered: boolean
  municipality: string
  channel: string
  job_url: string | null
  status: string
  deleted_at: string | null
}

function toApplication(row: Row): unknown {
  return {
    id: row.id,
    jobTitle: row.job_title,
    employerName: row.employer_name,
    employmentType: row.employment_type,
    appliedAt: row.applied_at,
    surveyAnswered: row.survey_answered,
    municipality: row.municipality,
    channel: row.channel,
    jobUrl: row.job_url ?? undefined,
    status: row.status,
  }
}

function toRow(application: Application, userId: string): Record<string, unknown> {
  return {
    id: application.id,
    user_id: userId,
    job_title: application.jobTitle,
    employer_name: application.employerName,
    employment_type: application.employmentType,
    applied_at: application.appliedAt,
    survey_answered: application.surveyAnswered,
    municipality: application.municipality,
    channel: application.channel,
    job_url: application.jobUrl ?? null,
    status: application.status,
    deleted_at: null,
    updated_at: new Date().toISOString(),
  }
}

function fail(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`${what}: ${error.message}`)
}

export function createSupabaseSync(db: SupabaseClient, userId: string): CloudSync {
  return {
    async pull() {
      const { data, error } = await db.from('applications').select('*')
      fail('Kunde inte hämta dina ansökningar', error)
      const rows = (data ?? []) as Row[]
      const live: Application[] = []
      const deletedIds: string[] = []
      for (const row of rows) {
        if (row.deleted_at) {
          deletedIds.push(row.id)
          continue
        }
        const candidate = toApplication(row)
        // A row that does not satisfy the model is skipped rather than allowed
        // to poison the local store — the same rule the backup import follows.
        if (isApplication(candidate)) live.push(candidate)
      }

      const profileResult = await db.from('profiles').select('*')
      fail('Kunde inte hämta din profil', profileResult.error)
      const profileRow = (profileResult.data ?? [])[0] as
        | {
            user_id: string
            first_name: string
            last_name: string
            email: string
            base_letter: string
            details: Record<string, string>
            cv_file_name: string | null
            cv_text: string | null
            cv_byte_size: number | null
          }
        | undefined

      return {
        applications: live,
        deletedIds,
        cvMeta: profileRow?.cv_file_name
          ? {
              fileName: profileRow.cv_file_name,
              text: profileRow.cv_text ?? '',
              byteSize: profileRow.cv_byte_size ?? 0,
            }
          : null,
        profile: profileRow
          ? {
              id: profileRow.user_id,
              firstName: profileRow.first_name,
              lastName: profileRow.last_name,
              email: profileRow.email,
              baseLetter: profileRow.base_letter,
              details: profileRow.details ?? {},
            }
          : null,
      }
    },

    async upsertApplication(application) {
      const { error } = await db
        .from('applications')
        .upsert(toRow(application, userId), { onConflict: 'id' })
      fail('Kunde inte spara ansökan i molnet', error)
    },

    async deleteApplication(id) {
      // Soft delete: the row must stay so other devices learn about it.
      const { error } = await db
        .from('applications')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      fail('Kunde inte ta bort ansökan i molnet', error)
    },

    async saveProfile(profile) {
      const { error } = await db.from('profiles').upsert(
        {
          user_id: userId,
          first_name: profile.firstName,
          last_name: profile.lastName,
          email: profile.email,
          base_letter: profile.baseLetter,
          // cvFileRef is deliberately absent: the CV blob stays on the device
          // until file sync is built, and a reference to a file that is not
          // there would be a lie on another device.
          details: profile.details,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      fail('Kunde inte spara profilen i molnet', error)
    },

    async uploadCvFile(cv) {
      // Ett CV per konto: samma väg, upsert skriver över. Filen i bucketen,
      // etiketterna på profilraden så en ny enhet kan visa namn/storlek direkt.
      const up = await db.storage
        .from(CV_BUCKET)
        .upload(cvPath(userId), cv.blob, {
          upsert: true,
          contentType: cv.blob.type || 'application/pdf',
        })
      fail('Kunde inte ladda upp CV:t', up.error)
      // Upsert, inte update: en ny enhet kan ladda upp CV:t innan profilraden
      // hunnit synkas. En update hade då träffat noll rader tyst, och en annan
      // enhet skulle aldrig se att CV:t finns. Vid konflikt uppdateras bara
      // CV-kolumnerna — namn/mejl på en befintlig rad rörs inte, och på en ny
      // rad tar övriga NOT NULL-kolumner sitt DEFAULT ''.
      const meta = await db.from('profiles').upsert(
        {
          user_id: userId,
          cv_file_name: cv.fileName,
          cv_text: cv.text,
          cv_byte_size: cv.byteSize,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      fail('Kunde inte spara CV-uppgifterna', meta.error)
    },

    async downloadCvFile() {
      const meta = await db
        .from('profiles')
        .select('cv_file_name, cv_text, cv_byte_size')
        .eq('user_id', userId)
        .maybeSingle()
      fail('Kunde inte hämta CV-uppgifterna', meta.error)
      const row = meta.data as
        | { cv_file_name: string | null; cv_text: string | null; cv_byte_size: number | null }
        | null
      if (!row?.cv_file_name) return null
      const dl = await db.storage.from(CV_BUCKET).download(cvPath(userId))
      // 404 = filen finns inte (t.ex. metadata utan fil) — behandla som inget CV.
      if (dl.error || !dl.data) return null
      return {
        fileName: row.cv_file_name,
        text: row.cv_text ?? '',
        byteSize: row.cv_byte_size ?? dl.data.size,
        blob: dl.data,
      }
    },

    async createCvLink(expiresInSeconds) {
      // Filnamnet från profilraden blir nedladdningsnamn hos arbetsgivaren —
      // "Mahad Hussen CV.pdf", inte "cv". Ingen metadata = inget CV i molnet.
      const meta = await db
        .from('profiles')
        .select('cv_file_name')
        .eq('user_id', userId)
        .maybeSingle()
      const fileName = (meta.data as { cv_file_name: string | null } | null)?.cv_file_name
      if (!fileName) return null
      const signed = await db.storage
        .from(CV_BUCKET)
        .createSignedUrl(cvPath(userId), expiresInSeconds, { download: fileName })
      if (signed.error || !signed.data?.signedUrl) return null
      return signed.data.signedUrl
    },

    async removeCvFile() {
      const rm = await db.storage.from(CV_BUCKET).remove([cvPath(userId)])
      fail('Kunde inte ta bort CV:t i molnet', rm.error)
      const meta = await db
        .from('profiles')
        .update({ cv_file_name: null, cv_text: null, cv_byte_size: null })
        .eq('user_id', userId)
      fail('Kunde inte nolla CV-uppgifterna', meta.error)
    },
  }
}
