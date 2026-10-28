// Jobbtiteln som ska stå i aktivitetsrapporten. Ren modul: inga importer
// från ui/render/services/app.
//
// Annonsrubriken är marknadsföring, inte en jobbtitel. Verkliga exempel ur
// Platsbanken: "Diskare med körkort sökes för extra jobb!", "Lokalvårdare
// Med körkort och tillgång till egen bil", "Städare (1-4 jobb)". I AF:s
// rapport ska det stå yrket — "Diskare", "Lokalvårdare".
//
// Två nivåer, i den ordningen:
//  1. AF:s EGEN yrkesetikett ur annonsens taxonomi (canonicalOccupation).
//     Den är auktoritativ och används för allt som loggas från och med nu.
//  2. För ansökningar som redan ligger sparade med rå rubrik: en försiktig
//     städning här. Den tar bara bort sådant som bevisligen är tillägg —
//     parentes, text efter tankstreck eller lodstreck, och utropstecken.
//     Den gissar ALDRIG bort ord mitt i en titel ("Lärare i matematik" ska
//     förbli hel), för en halv titel i en myndighetsrapport är värre än en
//     lång.

// Allt från och med dessa tecken är tillägg, inte titel.
const TAIL = [' – ', ' — ', ' | ', ' (', ' ['] as const

export function cleanJobTitle(raw: string): string {
  let text = raw.trim()
  for (const sep of TAIL) {
    const at = text.indexOf(sep)
    if (at > 0) text = text.slice(0, at)
  }
  return text
    .replace(/[!]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}
