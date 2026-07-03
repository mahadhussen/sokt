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
