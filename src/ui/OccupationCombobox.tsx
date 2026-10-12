import { useId, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";
import { searchOccupations } from "../jobs/occupationSearch";
import { useT } from "../i18n/useT";

// Yrkesförslag medan man skriver. Samma ARIA- och trycklogik som
// ortsökningen (role=combobox + aria-activedescendant, val på onMouseDown med
// preventDefault så inputens blur inte hinner stänga listan före trycket, och
// fokus kvar i inputen så telefontangentbordet inte fälls ihop).
//
// EN AVGÖRANDE SKILLNAD mot orten: orten måste bli ett kommun-id, men yrket
// går som fritext i API:ts `q`. Därför FÖRESLÅR den här rutan bara — skriver
// någon ett yrke som inte står i listan söks det ändå, precis som förut.
// Inget val tvingas fram, och Enter utan markerad rad söker direkt.
interface Props {
  value: string;
  onChange: (text: string) => void;
  /** Enter när ingen rad är markerad ska skicka formuläret som vanligt. */
  onSubmit: () => void;
}

export function OccupationCombobox({ value, onChange, onSubmit }: Props) {
  const { t } = useT();
  const listId = useId();
  const [open, setOpen] = useState(false);
  // -1 = ingen rad markerad: Enter söker på det som står i rutan.
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = open ? searchOccupations(value) : [];
  // Listan öppnas aldrig när förslaget är exakt det som redan står i rutan —
  // en ruta som skuggar sig själv med ett enda identiskt alternativ är brus.
  const listOpen =
    matches.length > 0 &&
    !(matches.length === 1 && matches[0].name === value.trim().toLowerCase());
  const activeId = listOpen && active >= 0 ? `${listId}-${active}` : undefined;

  function choose(name: string) {
    onChange(name);
    setOpen(false);
    setActive(-1);
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && listOpen) {
      event.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (event.key === "ArrowUp" && listOpen) {
      event.preventDefault();
      setActive((i) => (i <= 0 ? matches.length - 1 : i - 1));
    } else if (event.key === "Enter") {
      if (listOpen && active >= 0) {
        // Markerad rad väljs; sökningen sker med nästa Enter eller knapp.
        event.preventDefault();
        choose(matches[active].name);
      } else {
        // Inget markerat: sök på det som står i rutan — fritext är tillåtet.
        setOpen(false);
        setActive(-1);
        event.preventDefault();
        onSubmit();
      }
    } else if (event.key === "Escape" && listOpen) {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  function onBlur(event: FocusEvent<HTMLDivElement>) {
    if (rootRef.current?.contains(event.relatedTarget as Node | null)) return;
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className="ort-combobox yrke-combobox" ref={rootRef} onBlur={onBlur}>
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={listOpen}
        aria-controls={listOpen ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        className="ort-input"
        placeholder={t("search.qPlaceholder")}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {listOpen && (
        <ul
          className="ort-list"
          role="listbox"
          id={listId}
          aria-label={t("search.qSuggestions")}
        >
          {matches.map((m, i) => (
            <li
              key={m.name}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={
                i === active ? "ort-option ort-option-active" : "ort-option"
              }
              onMouseDown={(e) => {
                e.preventDefault();
                choose(m.name);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {m.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
