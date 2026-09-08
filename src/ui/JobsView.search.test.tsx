// @vitest-environment jsdom
//
// Låser finalize-före-submit i den RIKTIGA submit-vägen (JobsView-formuläret
// + MunicipalityCombobox), mätt mot fetch-parametern — inte mot komponentens
// interna state. Uppmätt hål före fixen: felstavning ("göteborj") + Enter,
// eller Escape + Enter, lät formuläret skicka medan fältet fortfarande visade
// text som inte filtrerade — sökningen körde ALLA orter (ingen
// municipality-parameter) bakom en ort i fältet. Fältet får ALDRIG visa en
// ort som inte filtrerar.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JobsView } from './JobsView'
import { resolveMunicipality } from '../jobs/municipalitySearch'

// Fångar varje fetch-URL och svarar med tomma träffar — testet mäter exakt
// vilka parametrar som lämnade appen, som Heisenberg mäter i nätverksloggen.
function stubFetch(): string[] {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input))
      return {
        ok: true,
        json: async () => ({ total: { value: 0 }, hits: [] }),
      } as unknown as Response
    }),
  )
  return calls
}

function jobSearchUrl(calls: string[]): URL {
  const hit = calls.find((u) => u.includes('jobsearch.api.jobtechdev.se'))
  expect(hit, 'ingen JobSearch-fetch skickades').toBeDefined()
  return new URL(hit as string)
}

async function searchSettled() {
  // Sök-knappen blir klickbar igen när runSearch är färdig — väntar in den
  // så inga state-uppdateringar landar utanför testet.
  await waitFor(() => {
    const button = screen.getByRole('button', { name: 'Sök jobb' })
    expect((button as HTMLButtonElement).disabled).toBe(false)
  })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('finalize före submit (ortfältet får aldrig visa en ort som inte filtrerar)', () => {
  it('felstavning + Enter: ingen municipality-parameter skickas och fältet töms FÖRE sökningen', async () => {
    const calls = stubFetch()
    render(<JobsView />)
    const user = userEvent.setup()
    const ort = screen.getByRole('combobox', { name: 'Ort' }) as HTMLInputElement

    await user.type(ort, 'göteborj')
    // "Ingen ort matchar" visas — Enter ska nu INTE kunna skicka en sökning
    // mot alla orter bakom den kvarstående felstavningen.
    await user.keyboard('{Enter}')

    const url = jobSearchUrl(calls)
    expect(url.searchParams.has('municipality')).toBe(false)
    // Fältet är tömt — det visar inte "göteborj" medan alla orter söks.
    expect(ort.value).toBe('')
    await searchSettled()
  })

  it('Escape + Enter med entydig text: texten löses till kommun-id och fetch-parametern bär det', async () => {
    const calls = stubFetch()
    render(<JobsView />)
    const user = userEvent.setup()
    const ort = screen.getByRole('combobox', { name: 'Ort' }) as HTMLInputElement

    await user.type(ort, 'malmo')
    // Escape stänger listan — Enter går då rakt till formulärets submit.
    await user.keyboard('{Escape}')
    await user.keyboard('{Enter}')

    const malmo = resolveMunicipality('malmo')
    expect(malmo).not.toBeNull()
    const url = jobSearchUrl(calls)
    expect(url.searchParams.get('municipality')).toBe(malmo?.id)
    // Fältet visar den lösta orten, inte råtexten.
    expect(ort.value).toBe(malmo?.name)
    await searchSettled()
  })
})
