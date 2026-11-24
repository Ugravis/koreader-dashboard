import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { streamSSE } from 'hono/streaming'
import { subscribe, type LiveEvent } from '../lib/events.ts'
import { errorResponse } from '../lib/openapi.ts'
import { requireSession } from '../middleware/session.ts'
import type { AppEnv } from '../types.ts'

/** Comment line sent while idle, so proxies and browsers keep the connection open. */
const HEARTBEAT_MS = 25_000

const getEvents = createRoute({
  method: 'get',
  path: '/',
  tags: ['me'],
  middleware: [requireSession] as const,
  responses: {
    200: {
      content: { 'text/event-stream': { schema: z.string() } },
      description:
        'Server-sent events: `ready`, then `sync`, `data`, `devices` (JSON data, see LiveEvent)',
    },
    401: errorResponse('Not signed in'),
  },
})

export const eventRoutes = new OpenAPIHono<AppEnv>().openapi(getEvents, (c) => {
  const userId = c.get('user').id
  // nginx and similar proxies would otherwise hold the events in their buffer.
  c.header('X-Accel-Buffering', 'no')
  return streamSSE(c, async (stream) => {
    const queue: LiveEvent[] = []
    let wake: (() => void) | null = null
    const unsubscribe = await subscribe(
      userId,
      (event) => {
        queue.push(event)
        wake?.()
      },
      // Events may have been lost: end the stream, the browser reconnects and refetches.
      () => stream.abort(),
    )
    stream.onAbort(() => {
      unsubscribe()
      wake?.()
    })

    await stream.writeSSE({ event: 'ready', data: '{}' })
    while (!stream.aborted) {
      const event = queue.shift()
      if (event) {
        await stream.writeSSE({ event: event.type, data: JSON.stringify(event) })
        continue
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, HEARTBEAT_MS)
        wake = () => {
          clearTimeout(timer)
          resolve()
        }
      })
      wake = null
      if (queue.length === 0 && !stream.aborted) await stream.write(': ping\n\n')
    }
    unsubscribe()
  })
})
