import { notFound } from 'next/navigation'
import { lang } from 'next/root-params'
import { isLocale } from './config'
import { dictionaries } from './dictionaries'

/** Locale of the current request, from the `[lang]` root segment. */
export async function getLocale() {
  const locale = await lang()
  if (!isLocale(locale)) notFound()
  return locale
}

export async function getDictionary() {
  return dictionaries[await getLocale()]
}

/** `generateMetadata` helper: a page title from the `meta` dictionary. */
export async function pageTitle(key: keyof Awaited<ReturnType<typeof getDictionary>>['meta']) {
  return { title: (await getDictionary()).meta[key] }
}
