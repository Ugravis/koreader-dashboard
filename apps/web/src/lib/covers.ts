/**
 * Book covers from Open Library, from the browser: by ISBN when KOReader has one, else a
 * search by title and author. Search results (including "no cover") are cached by md5.
 */

const CACHE_KEY = 'kd-covers-v1'
const SEARCH_URL = 'https://openlibrary.org/search.json'

type Cache = Record<string, number | null>

function readCache(): Cache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Cache
  } catch {
    return {}
  }
}

function writeCache(md5: string, coverId: number | null) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...readCache(), [md5]: coverId }))
  } catch {
    // Storage full or disabled: no cache.
  }
}

/** KOReader stores "N/A" when a book has no author or series. */
export const cleanMeta = (value: string | null) =>
  value && value.trim() !== '' && value !== 'N/A' ? value.trim() : null

const coverUrl = (id: number) => `https://covers.openlibrary.org/b/id/${id}-M.jpg`

const pending = new Map<string, Promise<string | null>>()

export function findCover(book: { md5: string; title: string; authors: string | null }) {
  const cache = readCache()
  if (book.md5 in cache) {
    const id = cache[book.md5]
    return Promise.resolve(id ? coverUrl(id) : null)
  }
  const existing = pending.get(book.md5)
  if (existing) return existing

  const params = new URLSearchParams({ title: book.title, limit: '1', fields: 'cover_i' })
  // KOReader joins several authors with newlines: search with the first one.
  const author = cleanMeta(book.authors)?.split('\n')[0]
  if (author) params.set('author', author)

  const promise = fetch(`${SEARCH_URL}?${params}`)
    .then((res) => (res.ok ? (res.json() as Promise<{ docs?: { cover_i?: number }[] }>) : null))
    .then((data) => {
      const id = data?.docs?.[0]?.cover_i ?? null
      writeCache(book.md5, id)
      return id ? coverUrl(id) : null
    })
    .catch(() => null)
    .finally(() => pending.delete(book.md5))
  pending.set(book.md5, promise)
  return promise
}

/** Direct cover by ISBN; 404 (default=false) when Open Library has none. */
export const isbnCoverUrl = (isbn: string) =>
  `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`
