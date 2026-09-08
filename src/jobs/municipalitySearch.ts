// Skrivbar stadssökning över kommun-taxonomin. Ren modul: inga imports från
// ui, render, services eller app.
//
// VARFÖR: 290 kommuner i en <select> är en jättelista att bläddra i på en
// telefon. Deltagaren skriver i stället ("göte") och väljer ur en krympande
// träfflista. M0-beslutet "Ort som kontroll, inte fritext" står orört: texten
// filtrerar LISTAN, men värdet som väljs är alltid ett kommun-concept-id ur
// MUNICIPALITIES. Fritext når aldrig API:t.
//
// Matchningen återanvänder yrkessökningens fold() (occupations.ts) — samma
// diakritvikning ("goteborg" träffar Göteborg, "malmo" träffar Malmö), ingen
// parallell normalisering. Ovanpå den viks bindestreck till mellanslag så att
// "malung salen" träffar Malung-Sälen och "dals ed" träffar Dals-Ed.

import { fold } from './occupations'
import { MUNICIPALITIES } from './municipalities'
import type { Municipality } from './municipalities'

// Max synliga träffar. 8 rader à 44px fyller drygt halva en 375×667-skärm
// med tangentbordet uppe — fler döljer bara Sök-knappen.
export const MAX_MUNICIPALITY_MATCHES = 8

function foldName(text: string): string {
  return fold(text.replace(/-/g, ' '))
}

const FOLDED: { folded: string; m: Municipality }[] = MUNICIPALITIES.map((m) => ({
  folded: foldName(m.name),
  m,
}))

// Rankning: exakt > prefix > substräng, alfabetisk ordning inom varje grupp
// (MUNICIPALITIES är redan sorterad). "berg" ⇒ Berg först, inte Åtvidaberg.
export function matchMunicipalities(
  query: string,
  limit = MAX_MUNICIPALITY_MATCHES,
): Municipality[] {
  const wanted = foldName(query)
  if (!wanted) return []
  const exact: Municipality[] = []
  const prefix: Municipality[] = []
  const substring: Municipality[] = []
  for (const { folded, m } of FOLDED) {
    if (folded === wanted) exact.push(m)
    else if (folded.startsWith(wanted)) prefix.push(m)
    else if (folded.includes(wanted)) substring.push(m)
  }
  return [...exact, ...prefix, ...substring].slice(0, limit)
}

export function municipalityById(id: string): Municipality | null {
  return MUNICIPALITIES.find((m) => m.id === id) ?? null
}

// Den kommun texten entydigt betyder, eller null. Används när fältet lämnas
// utan att en rad valts: "malmo" ska bli Malmö, inte tyst falla till "alla
// orter". Entydighet krävs — "habo" viker till både Habo och Håbo, och då
// vinner bara en bokstavstrogen skrivning (habo ⇒ Habo), aldrig en gissning.
export function resolveMunicipality(query: string): Municipality | null {
  const wanted = foldName(query)
  if (!wanted) return null
  const candidates = FOLDED.filter((f) => f.folded === wanted).map((f) => f.m)
  if (candidates.length === 1) return candidates[0]
  if (candidates.length > 1) {
    const literal = query.trim().toLowerCase()
    return candidates.find((m) => m.name.toLowerCase() === literal) ?? null
  }
  return null
}
