// Which letter engine to use. Pure module — no ui/services/app.
//
// GOALS M2: "AI assisted letter tailoring per job (letters only, never report
// fields)." The deterministic tailoring (tailorLetter) is the default and is
// always available offline and free. If the user has supplied their own
// Anthropic key, the AI provider is used to improve the letter. Report fields
// are never touched by either path — a letter is content, not an AF field.

export type LetterProviderId = 'deterministic' | 'anthropic'

export function chooseProvider(apiKey?: string | null): LetterProviderId {
  return apiKey && apiKey.trim() !== '' ? 'anthropic' : 'deterministic'
}
