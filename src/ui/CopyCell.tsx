import { useState } from "react";
import { useT } from "../i18n/useT";

// Ett värde som kopieras med ett tryck — samma vana som Pathlys
// genomförandenummer. HELA cellen är knappen, inte bara ikonen: i AF:s
// Mina sidor fylls fälten i ett och ett, och en liten ikon är en dålig
// tryckyta på telefon. Ikonen är bara affordansen.
//
// Ett nekat urklipp får aldrig se ut som ett lyckat (samma regel som
// resten av appen) — därför byts etiketten bara vid faktiskt lyckad
// kopiering, och felet skrivs ut.
export function CopyCell({ value, label }: { value: string; label?: string }) {
  const { t } = useT();
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");

  async function copy() {
    if (!value) return;
    // Nollställ felet vid varje försök: ett gammalt fel kvar bredvid ett
    // lyckat tryck ljuger lika mycket som ett falskt kvitto.
    setState("idle");
    try {
      await navigator.clipboard.writeText(value);
      setState("ok");
      setTimeout(() => setState("idle"), 1500);
    } catch {
      setState("fail");
    }
  }

  if (!value) return <span className="muted">–</span>;

  return (
    <button
      type="button"
      className={state === "ok" ? "copy-cell copy-cell-ok" : "copy-cell"}
      onClick={() => void copy()}
      title={t("copy.aria", { value: label ?? value })}
      aria-label={t("copy.aria", { value: label ?? value })}
    >
      <span className="copy-cell-value">{value}</span>
      <span className="copy-cell-icon" aria-hidden="true">
        {state === "ok" ? "✓" : "⧉"}
      </span>
      {state === "fail" && (
        <span className="error copy-cell-error">{t("copy.failed")}</span>
      )}
    </button>
  );
}
