// Versioned persistence format. The stored model round trips exactly.
// Pure module: no imports from ui, render, services, or app.

import type { Application, Profile } from './types'
import { isApplication, isProfile } from './validate'

export const SCHEMA_VERSION = 1 as const

export interface PersistedModel {
  schemaVersion: typeof SCHEMA_VERSION
  profile: Profile | null
  applications: Application[]
}

export function emptyModel(): PersistedModel {
  return { schemaVersion: SCHEMA_VERSION, profile: null, applications: [] }
}

export function serializeModel(model: PersistedModel): string {
  return JSON.stringify(model)
}

export function deserializeModel(json: string): PersistedModel {
  const raw: unknown = JSON.parse(json)
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Ogiltig modell: inte ett objekt')
  }
  const candidate = raw as Partial<PersistedModel>
  if (candidate.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Okänd schemaversion: ${String(candidate.schemaVersion)} (förväntade ${SCHEMA_VERSION})`,
    )
  }
  if (!Array.isArray(candidate.applications)) {
    throw new Error('Ogiltig modell: applications saknas')
  }
  // Validate every row rather than trusting the array. A single unreadable
  // record used to pass straight through to the render tree and, with no error
  // boundary, blank the app — locking the participant out of their own export
  // and delete buttons. Throwing here routes them to the backup path instead,
  // where the raw data is preserved and handed back to them.
  const bad = candidate.applications.findIndex((row) => !isApplication(row))
  if (bad >= 0) {
    throw new Error(`Ogiltig modell: ansökan ${bad + 1} går inte att läsa`)
  }
  if (candidate.profile !== undefined && candidate.profile !== null && !isProfile(candidate.profile)) {
    throw new Error('Ogiltig modell: profilen går inte att läsa')
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: candidate.profile ?? null,
    applications: candidate.applications,
  }
}
