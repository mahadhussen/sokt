// Edits are commands with apply and invert. Nothing mutates outside a command.

import type { Application, Profile } from '../model/types'

export interface ModelState {
  profile: Profile | null
  applications: Application[]
}

export interface Command {
  label: string
  apply(state: ModelState): ModelState
  invert(state: ModelState): ModelState
}

export function setProfileCommand(profile: Profile): Command {
  let previous: Profile | null = null
  return {
    label: 'Spara profil',
    apply(state) {
      previous = state.profile
      return { ...state, profile }
    },
    invert(state) {
      return { ...state, profile: previous }
    },
  }
}

export function addApplicationCommand(application: Application): Command {
  return {
    label: 'Logga ansökan',
    apply(state) {
      return { ...state, applications: [...state.applications, application] }
    },
    invert(state) {
      return {
        ...state,
        applications: state.applications.filter((a) => a.id !== application.id),
      }
    },
  }
}

export function removeApplicationCommand(applicationId: string): Command {
  let removed: Application | undefined
  let index = -1
  return {
    label: 'Ta bort ansökan',
    apply(state) {
      index = state.applications.findIndex((a) => a.id === applicationId)
      removed = index >= 0 ? state.applications[index] : undefined
      return {
        ...state,
        applications: state.applications.filter((a) => a.id !== applicationId),
      }
    },
    invert(state) {
      if (!removed || index < 0) return state
      const applications = [...state.applications]
      applications.splice(index, 0, removed)
      return { ...state, applications }
    },
  }
}
