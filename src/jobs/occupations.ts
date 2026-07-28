// Common occupations, and the bridge from a keyboard without å/ä/ö.
// Pure module: no imports from ui, render, services, or app.
//
// WHY THIS EXISTS: the JobTech API does no diacritic folding. Verified live —
// `underskoterska` returns 0 hits while `undersköterska` returns 26; `stadare`
// 0 while `städare` returns 733. Our participants often type on an Arabic or
// Somali keyboard, or are simply unsure of å/ä/ö, so the app's primary control
// hands them a silent dead end on their most likely input.
//
// Brute-forcing the variants is not an option: each `a` has three candidates
// (a/å/ä) and each `o` two (o/ö), so "lokalvardare" alone is 54 spellings —
// 54 API calls. Instead we fold the query and match it against a curated list
// of the occupations this audience actually searches for. Deterministic, no
// extra requests, and wrong at worst by suggesting nothing.
//
// The list is also the seed of the real long-term fix: an occupation picker
// that searches by concept, so nobody has to type Swedish at all.

// Lowercase, strip Swedish diacritics. Both sides of a comparison get folded,
// so this is a canonical form rather than a translation.
export function fold(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[åä]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é/g, 'e')
    .replace(/\s+/g, ' ')
}

export function hasSwedishDiacritics(text: string): boolean {
  return /[åäöÅÄÖ]/.test(text)
}

// Occupations common in Rusta och Matcha. Only the ones carrying å/ä/ö can
// produce a suggestion; the rest are here because this list becomes the
// picker.
export const COMMON_OCCUPATIONS: string[] = [
  // Vård och omsorg
  'undersköterska',
  'sjuksköterska',
  'vårdbiträde',
  'personlig assistent',
  'stödassistent',
  'stödpedagog',
  'hemtjänst',
  'barnskötare',
  'elevassistent',
  'fritidsledare',
  'förskollärare',
  'lärare',
  // Städ och fastighet
  'lokalvårdare',
  'städare',
  'hotellstädare',
  'fönsterputsare',
  'saneringstekniker',
  'fastighetsskötare',
  'vaktmästare',
  'trädgårdsarbetare',
  'tvättbiträde',
  // Lager, logistik och transport
  'lagerarbetare',
  'truckförare',
  'terminalarbetare',
  'orderplockare',
  'chaufför',
  'lastbilsförare',
  'budbilsförare',
  'taxiförare',
  'bussförare',
  'flyttkarl',
  // Restaurang och livsmedel
  'kock',
  'kallskänka',
  'köksbiträde',
  'diskare',
  'servitör',
  'servitris',
  'barista',
  'pizzabagare',
  'bagare',
  'restaurangbiträde',
  'slaktare',
  // Handel och service
  'butiksbiträde',
  'butikssäljare',
  'kassabiträde',
  'säljare',
  'telefonförsäljare',
  'lagerbiträde',
  'frisör',
  'väktare',
  'ordningsvakt',
  'tolk',
  // Bygg och industri
  'byggnadsarbetare',
  'snickare',
  'målare',
  'elektriker',
  'svetsare',
  'montör',
  'maskinoperatör',
  'processoperatör',
  'industriarbetare',
  'plåtslagare',
  'murare',
  'betongarbetare',
  'anläggningsarbetare',
  'vvs-montör',
  'lackerare',
  // Kontor
  'administratör',
  'receptionist',
  'ekonomiassistent',
  'löneadministratör',
  'kundtjänstmedarbetare',
  'handläggare',
  'säkerhetstekniker',
  'systemutvecklare',
  'testare',
]

const FOLDED: { folded: string; name: string }[] = COMMON_OCCUPATIONS.map((name) => ({
  folded: fold(name),
  name,
}))

// The Swedish spelling the user probably meant, or null when we have nothing
// useful to offer. Only fires for a query written without å/ä/ö — a query that
// already has them is not a folding problem, and guessing would be noise.
export function suggestOccupation(query: string): string | null {
  const wanted = fold(query)
  if (!wanted || hasSwedishDiacritics(query)) return null

  const exact = FOLDED.find((o) => o.folded === wanted)
  const prefix = exact ?? FOLDED.find((o) => o.folded.startsWith(wanted))
  const match = prefix ?? FOLDED.find((o) => o.folded.includes(wanted))
  if (!match) return null

  // Nothing to suggest when the user already typed the right thing.
  return match.name === query.toLowerCase().trim() ? null : match.name
}
