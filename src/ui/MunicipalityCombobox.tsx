import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent, Ref } from 'react'
import {
  matchMunicipalities,
  municipalityById,
  resolveMunicipality,
} from '../jobs/municipalitySearch'
import { useT } from '../i18n/useT'

// Skrivbar stadssökning: texten filtrerar kommunlistan, men värdet som lämnar
// komponenten är ALLTID ett kommun-concept-id ur taxonomin eller '' (= alla
// orter). Fritext når aldrig API:t (M0-beslutet "Ort som kontroll, inte
// fritext").
//
// ARIA-valet: fullt combobox-mönster (role=combobox + aria-activedescendant
// mot en listbox) i stället för en knapplista. Skälet: fokus ska LIGGA KVAR i
// inputen hela tiden — på telefon får tangentbordet inte fällas ihop när man
// pilar/tittar i listan, och activedescendant är standardmönstret för just
// det. Raderna är därför role=option (inte <button>): de ska inte kunna ta
// fokus, bara tryckas. Val sker på onMouseDown med preventDefault så att
// inputens blur aldrig hinner stänga listan före trycket (klassisk
// Safari-bugg med click-baserade comboboxar).
interface Props {
  value: string
  onChange: (id: string) => void
  /** Imperativt handtag så formulärets submit-väg kan köra finalize FÖRE
      sökningen (React 19: ref som vanlig prop). */
  ref?: Ref<MunicipalityComboboxHandle>
}

export interface MunicipalityComboboxHandle {
  /** Löser fältets text till ett kommun-id ('' = alla orter) och städar
      fältet. Returvärdet är id:t sökningen SKA använda — synkront, så att
      submit aldrig behöver vänta på en state-uppdatering eller en blur. */
  finalize: () => string
}

export function MunicipalityCombobox({ value, onChange, ref }: Props) {
  const { t } = useT()
  const listId = useId()
  const selected = value ? municipalityById(value) : null
  const [text, setText] = useState(selected?.name ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Val inifrån komponenten ska inte studsa tillbaka via synkeffekten nedan.
  const skipSync = useRef(false)
  // choose() blurar inputen för att fälla ihop tangentbordet; den bluren får
  // inte trigga finalize() — den kör synkront på texten FÖRE valet (uppmätt:
  // "göte" löste inte och tömde fältet fast Göteborg just valts).
  const skipBlur = useRef(false)

  // Yttre ändringar (tagg trycks, senaste sökningen återställs) uppdaterar
  // det visade namnet; egna val hoppar över (texten är redan satt).
  useEffect(() => {
    if (skipSync.current) {
      skipSync.current = false
      return
    }
    setText(value ? (municipalityById(value)?.name ?? '') : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const matches = open ? matchMunicipalities(text) : []
  const expanded = open && text.trim().length > 0
  // Listboxen finns i DOM bara när det finns träffar — aria-expanded och
  // aria-controls får bara peka på den då. "Ingen ort matchar"-läget är en
  // role=status-region UTAN listbox-id: en combobox som pekar på ett id som
  // inte är en listbox är ett ARIA-kontraktsbrott.
  const listOpen = expanded && matches.length > 0
  const activeId = listOpen && matches[active] ? `${listId}-${matches[active].id}` : undefined

  function commit(id: string) {
    if (id !== value) {
      skipSync.current = true
      onChange(id)
    }
  }

  function choose(id: string, name: string) {
    commit(id)
    setText(name)
    setOpen(false)
    // Valet är gjort — fäll ihop telefontangentbordet.
    skipBlur.current = true
    inputRef.current?.blur()
  }

  function clear() {
    commit('')
    setText('')
    setOpen(false)
  }

  // Fältet lämnas eller formuläret skickas: entydig text väljer sig själv
  // ("malmo" ⇒ Malmö — även när man skriver hela namnet och trycker Sök
  // direkt utan att röra listan). Otydlig rest ("göteborj") töms hellre än
  // står kvar och ser vald ut fast sökningen kör alla orter. Returnerar id:t
  // synkront så submit-vägen kan använda det direkt — uppmätt hål innan:
  // felstavning+Enter och Escape+Enter nådde submit UTAN finalize (blur fyrar
  // aldrig vid Enter) och sökningen körde alla orter bakom en ort i fältet.
  function finalize(): string {
    setOpen(false)
    const resolved = resolveMunicipality(text)
    if (resolved) {
      commit(resolved.id)
      setText(resolved.name)
      return resolved.id
    }
    commit('')
    setText('')
    return ''
  }

  useImperativeHandle(ref, () => ({ finalize }))

  function onBlur(event: FocusEvent) {
    if (skipBlur.current) {
      skipBlur.current = false
      return
    }
    if (rootRef.current?.contains(event.relatedTarget as Node)) return
    finalize()
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        setActive(0)
        return
      }
      if (matches.length === 0) return
      setActive((i) =>
        event.key === 'ArrowDown' ? Math.min(i + 1, matches.length - 1) : Math.max(i - 1, 0),
      )
      return
    }
    if (event.key === 'Enter' && listOpen && matches[active]) {
      // Väljer träffen i stället för att skicka formuläret. Alla andra
      // Enter-fall (felstavning utan träff, stängd lista efter Escape) går
      // vidare till formulärets submit, som kör finalize() före sökningen.
      event.preventDefault()
      choose(matches[active].id, matches[active].name)
      return
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="ort-combobox" ref={rootRef} onBlur={onBlur}>
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="words"
        spellCheck={false}
        role="combobox"
        aria-expanded={listOpen}
        aria-controls={listOpen ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-label={t('search.ortLabel')}
        className={selected ? 'ort-input ort-selected' : 'ort-input'}
        placeholder={t('search.ortPlaceholder')}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setActive(0)
          setOpen(true)
          // Redigerad text är inte längre den valda orten.
          if (value) commit('')
        }}
        onFocus={(e) => e.target.select()}
        onKeyDown={onKeyDown}
      />
      {(text.length > 0 || value) && (
        <button
          type="button"
          className="ort-clear"
          aria-label={t('search.ortClearAria')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={clear}
        >
          ×
        </button>
      )}
      {listOpen && (
        <ul className="ort-list" role="listbox" id={listId} aria-label={t('search.ortLabel')}>
          {matches.map((m, i) => (
            <li
              key={m.id}
              id={`${listId}-${m.id}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'ort-option ort-option-active' : 'ort-option'}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(m.id, m.name)
              }}
              onMouseEnter={() => setActive(i)}
            >
              {m.name}
            </li>
          ))}
        </ul>
      )}
      {expanded && matches.length === 0 && (
        // Ingen listbox i tomläget — statusen bär medvetet INTE listbox-id:t
        // (aria-controls från inputen pekar då på ingenting, vilket är rätt:
        // det finns ingen popup att kontrollera).
        <div className="ort-list ort-empty" role="status">
          {t('search.ortNoMatch')}
        </div>
      )}
    </div>
  )
}
