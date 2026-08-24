// The backup file: everything the participant has, in one document they own.
// Pure module: no imports from ui, render, services, or app.
//
// WHY THIS EXISTS: the app kept a participant's entire application history and
// their CV in one browser, on one device, with no way back in. Safari clears
// script-writable storage after seven days without a visit; phones break and
// get replaced; the library computer is not the same computer next week. The
// old export was also not what it claimed — it wrote "all your data" while
// omitting the CV blob, and nothing in the codebase could read it back.
//
// A backup is only a backup if it restores. This module is the format and the
// validation; the store does the writing.

import type { Application, Profile } from './types'
import { isApplication, isProfile } from './validate'

export const BACKUP_VERSION = 1 as const

export interface BackupCv {
  fileName: string
  text: string
  byteSize: number
  dataBase64: string
}

export interface BackupFile {
  sokt: 'backup'
  version: number
  exportedAt: string
  profile: Profile | null
  applications: Application[]
  savedSearches: unknown[]
  cv?: BackupCv
}

export interface ParsedBackup {
  backup: BackupFile
  // Rows that were present but unreadable. Restoring is a recovery path, so we
  // salvage what we can and say plainly what we could not.
  droppedApplications: number
}

function isBackupCv(value: unknown): value is BackupCv {
  if (typeof value !== 'object' || value === null) return false
  const cv = value as Partial<BackupCv>
  return (
    typeof cv.fileName === 'string' &&
    typeof cv.text === 'string' &&
    typeof cv.byteSize === 'number' &&
    typeof cv.dataBase64 === 'string'
  )
}

export function parseBackup(json: string): ParsedBackup {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error('Filen är inte en giltig JSON-fil')
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Filen innehåller ingen säkerhetskopia')
  }
  const candidate = raw as Partial<BackupFile>
  if (candidate.sokt !== 'backup') {
    throw new Error('Filen är inte en säkerhetskopia från Sökt')
  }
  if (typeof candidate.version !== 'number' || candidate.version > BACKUP_VERSION) {
    throw new Error(
      `Säkerhetskopian är gjord i en nyare version av Sökt (${String(candidate.version)})`,
    )
  }
  const rows = Array.isArray(candidate.applications) ? candidate.applications : []
  const applications = rows.filter(isApplication)
  return {
    backup: {
      sokt: 'backup',
      version: candidate.version,
      exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : '',
      profile: isProfile(candidate.profile) ? candidate.profile : null,
      applications,
      savedSearches: Array.isArray(candidate.savedSearches) ? candidate.savedSearches : [],
      cv: isBackupCv(candidate.cv) ? candidate.cv : undefined,
    },
    droppedApplications: rows.length - applications.length,
  }
}

export interface MergeResult {
  applications: Application[]
  profile: Profile | null
  addedApplications: number
}

// Restoring must never destroy. A participant restoring onto a device that
// already has data keeps everything it had: applications merge by id, and an
// existing profile wins over the one in the file.
export function mergeBackup(
  current: { profile: Profile | null; applications: Application[] },
  backup: BackupFile,
): MergeResult {
  const seen = new Set(current.applications.map((a) => a.id))
  const added = backup.applications.filter((a) => !seen.has(a.id))
  return {
    applications: [...current.applications, ...added],
    profile: current.profile ?? backup.profile,
    addedApplications: added.length,
  }
}
