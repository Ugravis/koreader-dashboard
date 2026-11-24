import sharp from 'sharp'
import { beforeEach, describe, expect, it } from 'vitest'
import { app, pairDevice, request, resetDb, signUp } from './helpers.ts'

const book = (md5: string, title = 'After, Tome 1') => ({
  md5,
  title,
  authors: 'Anna Todd',
  file_path: `/books/${title}.epub`,
})

const putCover = (md5: string, token: string, body: Uint8Array, title = 'After, Tome 1') =>
  app.request(`/v1/library/covers/${md5}?path=${encodeURIComponent(`/books/${title}.epub`)}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
    body,
  })

const png = (width: number, height: number, r = 200) =>
  sharp({ create: { width, height, channels: 4, background: { r, g: 30, b: 30, alpha: 1 } } })
    .png()
    .toBuffer()

type Books = { books: { id: string; title: string; cover_url: string | null }[] }

describe('covers', () => {
  beforeEach(resetDb)

  it('resizes the cover, keeps colour and serves it for every merged entry', async () => {
    const { cookie } = await signUp()
    const token = await pairDevice(cookie)
    await request('/v1/library', {
      body: { books: [book('aaa'), book('bbb')] },
      headers: { authorization: `Bearer ${token}` },
    })

    const res = await putCover('bbb', token, await png(1200, 1800))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ width: 400, height: 600 })

    const { books } = (await (
      await request('/v1/me/books', { headers: { cookie } })
    ).json()) as Books
    expect(books).toHaveLength(1)
    expect(books[0]!.cover_url).toMatch(/^\/v1\/me\/books\/[0-9a-f-]+\/cover\?v=\d+$/)

    const img = await request(books[0]!.cover_url!, { headers: { cookie } })
    expect(img.status).toBe(200)
    expect(img.headers.get('content-type')).toBe('image/jpeg')
    const { data, info } = await sharp(Buffer.from(await img.arrayBuffer()))
      .raw()
      .toBuffer({ resolveWithObject: true })
    expect(info).toMatchObject({ width: 400, height: 600, channels: 3 })
    expect(data[0]).toBeGreaterThan(150)
    expect(data[1]).toBeLessThan(80)
  })

  it('rejects unknown books, non-images and other users', async () => {
    const { cookie } = await signUp()
    const token = await pairDevice(cookie)
    expect((await putCover('nope', token, await png(10, 10))).status).toBe(404)

    await request('/v1/library', {
      body: { books: [book('aaa')] },
      headers: { authorization: `Bearer ${token}` },
    })
    expect((await putCover('aaa', token, new TextEncoder().encode('not an image'))).status).toBe(
      400,
    )
    expect((await putCover('aaa', token, new Uint8Array(9 * 1024 * 1024))).status).toBe(413)
    expect((await putCover('aaa', 'bad-token', await png(10, 10))).status).toBe(401)

    const { books } = (await (
      await request('/v1/me/books', { headers: { cookie } })
    ).json()) as Books
    expect(books[0]!.cover_url).toBeNull()
    await putCover('aaa', token, await png(10, 10))
    const other = await signUp()
    const res = await request(`/v1/me/books/${books[0]!.id}/cover`, {
      headers: { cookie: other.cookie },
    })
    expect(res.status).toBe(404)
  })

  it('keeps one cover per file when two files share a md5', async () => {
    const { cookie } = await signUp()
    const token = await pairDevice(cookie)
    // A sidecar copied from another book carries that book's md5.
    await request('/v1/library', {
      body: { books: [book('same', 'After, Tome 2'), book('same', 'Le Silmarillion')] },
      headers: { authorization: `Bearer ${token}` },
    })
    expect((await putCover('same', token, await png(10, 10, 250), 'After, Tome 2')).status).toBe(
      200,
    )
    expect((await putCover('same', token, await png(10, 10, 0), 'Le Silmarillion')).status).toBe(
      200,
    )

    const { books } = (await (
      await request('/v1/me/books', { headers: { cookie } })
    ).json()) as Books
    const red = async (title: string) => {
      const url = books.find((b) => b.title === title)!.cover_url!
      const img = await request(url, { headers: { cookie } })
      const { data } = await sharp(Buffer.from(await img.arrayBuffer()))
        .raw()
        .toBuffer({ resolveWithObject: true })
      return data[0]!
    }
    expect(await red('After, Tome 2')).toBeGreaterThan(200)
    expect(await red('Le Silmarillion')).toBeLessThan(50)
  })
})
