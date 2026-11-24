import sharp from 'sharp'
import { HttpError } from './errors.ts'

/** Stored size: twice the largest cover shown on the web (book page), for HiDPI screens. */
export const COVER_MAX_WIDTH = 400
export const COVER_MAX_HEIGHT = 600

/** Book cover as a small JPEG, colours kept. Throws 400 when the data is not an image. */
export async function resizeCover(input: Buffer) {
  try {
    const { data, info } = await sharp(input, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize({
        width: COVER_MAX_WIDTH,
        height: COVER_MAX_HEIGHT,
        fit: 'inside',
        withoutEnlargement: true,
      })
      // Transparent PNG/GIF covers: white page instead of a black background.
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer({ resolveWithObject: true })
    return { image: data, width: info.width, height: info.height }
  } catch {
    throw new HttpError(400, 'invalid_image', 'Not a supported image')
  }
}
