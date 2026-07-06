// Translation hook. Reads the current language from the store and returns a
// bound translator plus the raw language (for dir/label helpers).

import { useSoktStore } from '../app/store'
import { translate } from './translations'
import type { Lang } from './translations'

export interface Translator {
  t: (key: string, params?: Record<string, string | number>) => string
  lang: Lang
}

export function useT(): Translator {
  const lang = useSoktStore((s) => s.lang)
  return {
    lang,
    t: (key, params) => translate(lang, key, params),
  }
}
