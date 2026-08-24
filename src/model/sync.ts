// Merging this device with the account. Pure module: no imports from ui,
// render, services, or app.
//
// The rules exist to make sync incapable of losing an application:
//
//  * A row this device has and the account does not is UPLOADED, never dropped.
//    Signing in on a phone that has been used offline for a month must not cost
//    that month.
//  * A row the account has and this device does not is ADDED. That is the whole
//    point: the broken phone, the cleared browser, the library computer.
//  * A row the account says was deleted is REMOVED here too — otherwise a
//    delete on one device is resurrected by the next sync from another, and
//    the participant cannot get rid of it anywhere.
//  * An existing local row is never overwritten by the account's copy. Both
//    sides are the same participant's own edits, and the one in front of them
//    is the one they can see.

import type { Application, Profile } from './types'

export interface LocalState {
  profile: Profile | null
  applications: Application[]
}

export interface RemoteSnapshot {
  profile: Profile | null
  applications: Application[]
  deletedIds: string[]
}

export interface MergedState {
  profile: Profile | null
  applications: Application[]
  // Rows the account has never seen; the caller pushes these up.
  toUpload: Application[]
  addedFromAccount: number
  removedAsDeleted: number
}

export function mergeRemote(local: LocalState, remote: RemoteSnapshot): MergedState {
  const deleted = new Set(remote.deletedIds)
  const kept = local.applications.filter((a) => !deleted.has(a.id))
  const removedAsDeleted = local.applications.length - kept.length

  const localIds = new Set(kept.map((a) => a.id))
  const fromAccount = remote.applications.filter((a) => !localIds.has(a.id))

  const remoteIds = new Set([...remote.applications.map((a) => a.id), ...remote.deletedIds])
  const toUpload = kept.filter((a) => !remoteIds.has(a.id))

  return {
    profile: local.profile ?? remote.profile,
    applications: [...kept, ...fromAccount],
    toUpload,
    addedFromAccount: fromAccount.length,
    removedAsDeleted,
  }
}
