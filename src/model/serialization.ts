// Versioned persistence format. The stored model round trips exactly.
// Pure module: no imports from ui, render, services, or app.

import type { Application, Profile } from './types'

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
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: candidate.profile ?? null,
    applications: candidate.applications,
  }
}
