import type { ContentfulStatusCode } from 'hono/utils/http-status'

export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export const errorBody = (code: string, message: string) => ({ error: { code, message } })
