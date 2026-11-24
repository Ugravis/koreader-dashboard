import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
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

export const onError: ErrorHandler = (err, c) => {
  if (err instanceof HttpError) return c.json(errorBody(err.code, err.message), err.status)
  if (err instanceof HTTPException) return c.json(errorBody('http_error', err.message), err.status)
  console.error(err)
  return c.json(errorBody('internal_error', 'Internal server error'), 500)
}
