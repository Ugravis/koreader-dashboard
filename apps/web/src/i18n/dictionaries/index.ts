import type { Locale } from '../config'
import { en, type Dictionary } from './en'
import { fr } from './fr'

export type { Dictionary }

/** Both are small: bundled as is, so client components read them without a fetch. */
export const dictionaries: Record<Locale, Dictionary> = { en, fr }
