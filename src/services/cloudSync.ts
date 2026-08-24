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
import type { SupabaseClient } from '@supabase/supabase-js'

export interface RemoteState {
  profile: Profile | null
  applications: Application[]
  // Ids the server considers deleted. Without this a delete on one device is
  // resurrected by the next sync from another — the row is simply absent, which
  // is indistinguishable from "not uploaded yet".
  deletedIds: string[]
}

export interface CloudSync {
  pull(): Promise<RemoteState>
  upsertApplication(application: Application): Promise<void>
  deleteApplication(id: string): Promise<void>
  saveProfile(profile: Profile): Promise<void>
}

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
          }
        | undefined

      return {
        applications: live,
        deletedIds,
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
  }
}
