// Yrkesförslag medan deltagaren skriver. Ren modul: inga importer från
// ui/render/services/app.
//
// Skiljer sig från ortsökningen i en viktig sak: orten MÅSTE bli ett
// kommun-id (API:t kräver en kontroll), men yrket går som fritext i `q`.
// Därför föreslår den här modulen — den tvingar aldrig. Skriver någon ett
// yrke som inte står i listan söks det ändå.
//
// Varför inte bara diakrittolkning (fold): målgruppen stavar fel på riktigt,
// inte bara å/ä/ö. "matbiträdare" finns inte som yrke — men den som skriver
// så menar nästan säkert något av biträdesyrkena, och en lista som svarar
// "inget" på det är värdelös. Därför rankas också delad ordstam.

import { COMMON_OCCUPATIONS, fold } from "./occupations";

export interface OccupationMatch {
  name: string;
  // Lägre = bättre träff. Exponerad för test, inte för UI:t.
  rank: number;
}

// Levenshtein med tak: avbryter så fort avståndet säkert överstiger `max`,
// så ett långt ord aldrig kostar en full matris i onödan.
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      row.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

// Längsta gemensamma delsträng. Används för ordstammen: "matbitradare" och
// "koksbitrade" delar "bitrad".
function longestSharedRun(a: string, b: string): number {
  let best = 0;
  const prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = 0;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = prev[j];
      if (a[i - 1] === b[j - 1]) {
        prev[j] = diag + 1;
        if (prev[j] > best) best = prev[j];
      } else {
        prev[j] = 0;
      }
      diag = temp;
    }
  }
  return best;
}

// 6, inte 5: vid 5 matchade den generiska ändelsen "-adare" så att
// "matbiträdare" föreslog städare FÖRE köksbiträde (uppmätt). Sex tecken
// kräver en riktig ordstam ("bitrad"), inte en böjningsändelse.
const STEM = 6;

function rankOf(query: string, candidate: string): number | null {
  if (candidate === query) return 0;
  if (candidate.startsWith(query)) return 1;
  if (candidate.includes(query)) return 2;
  if (query.includes(candidate)) return 3;
  // Stavfel: "lokalvardre" ⇒ lokalvårdare.
  if (query.length >= 4 && editDistance(query, candidate) <= 2) return 4;
  // Delad ordstam: "matbitradare" ⇒ köksbiträde, vårdbiträde, tvättbiträde.
  if (query.length >= STEM && longestSharedRun(query, candidate) >= STEM)
    return 5;
  return null;
}

// Rankade yrkesförslag. Tom query ⇒ inga förslag (listan ska inte öppna sig
// som en meny av 80 yrken innan någon skrivit något).
export function searchOccupations(query: string, limit = 8): OccupationMatch[] {
  const q = fold(query);
  if (!q) return [];
  const out: OccupationMatch[] = [];
  for (const name of COMMON_OCCUPATIONS) {
    const rank = rankOf(q, fold(name));
    if (rank !== null) out.push({ name, rank });
  }
  // Stabil ordning: rank först, sedan kortast namn (det mest generella
  // yrket), sedan bokstavsordning — samma query ger alltid samma lista.
  out.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.name.length - b.name.length ||
      a.name.localeCompare(b.name, "sv"),
  );
  return out.slice(0, limit);
}
