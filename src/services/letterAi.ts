// Anthropic-backed letter improvement. Edge module (network) — lives in
// services, not the pure apply layer. Called only when the user has supplied
// their own Anthropic API key (stored locally). Produces letter content only;
// it never sees or writes activity-report fields.

import type { Job, Profile } from '../model/types'
import { canonicalOccupation } from '../jobs/taxonomy'

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM =
  'Du skriver korta, konkreta och personliga ansökningsbrev på svenska. ' +
  'Skriv endast själva brevet, ingen förklaring och inga platshållare i hakparentes. ' +
  'Var sann mot de uppgifter du får — hitta inte på erfarenheter, utbildning eller egenskaper. ' +
  'Håll det till cirka 150 ord, artigt och naturligt.'

export interface ImproveLetterArgs {
  job: Job
  profile: Profile
  currentLetter: string
  apiKey: string
}

export async function improveLetterWithAi(args: ImproveLetterArgs): Promise<string> {
  const { job, profile, currentLetter, apiKey } = args
  const occupation = canonicalOccupation(job.taxonomy, job.title)
  const prompt = [
    `Tjänst: ${job.title} (${occupation})`,
    `Arbetsgivare: ${job.employer}`,
    job.municipality ? `Ort: ${job.municipality}` : '',
    `Sökande: ${`${profile.firstName} ${profile.lastName}`.trim()}`,
    '',
    'Utgå från den sökandes utkast och förbättra det till ett färdigt brev:',
    currentLetter || profile.baseLetter || '(inget utkast — skriv ett kort brev utifrån uppgifterna)',
  ]
    .filter(Boolean)
    .join('\n')

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    throw new Error(`AI-tjänsten svarade ${response.status}`)
  }
  const data = (await response.json()) as { content?: { type: string; text?: string }[] }
  const text = data.content?.find((c) => c.type === 'text')?.text?.trim()
  if (!text) throw new Error('AI-tjänsten gav ett tomt svar')
  return text
}
