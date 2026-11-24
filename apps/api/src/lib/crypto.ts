import { createHash, randomBytes, randomInt } from 'node:crypto'

// No 0/O, 1/I/L: easy to read on an e-ink screen and type on a phone.
export const USER_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const USER_CODE_LENGTH = 8

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export const randomToken = (prefix: string) => `${prefix}_${randomBytes(32).toString('base64url')}`

export function generateUserCode() {
  let code = ''
  for (let i = 0; i < USER_CODE_LENGTH; i++) {
    code += USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)]
  }
  return code
}

/** Accepts `abcd-efgh`, `ABCD EFGH`... and returns `ABCDEFGH`. */
export const normalizeUserCode = (input: string) => input.toUpperCase().replace(/[\s-]/g, '')
