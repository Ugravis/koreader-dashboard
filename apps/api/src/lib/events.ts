import { EventEmitter } from 'node:events'
import { createListener, sql } from '@koreader-dashboard/db'
import { db } from '../db.ts'
import { env } from '../env.ts'

/** Server → browser events, sent over `GET /v1/me/events` (SSE). */
export type LiveEvent =
  /** A device reported sync progress (start, step, covers left, end). */
  | {
      type: 'sync'
      device_id: string
      syncing: boolean
      sync_step: 'stats' | 'library' | 'covers' | null
      covers_pending: number | null
      last_sync_at: string
    }
  /** New reading data stored (statistics, library, cover): refetch. */
  | { type: 'data' }
  /** A device was linked, revoked or unlinked. */
  | { type: 'devices' }

/**
 * Pub/sub across API instances through Postgres NOTIFY: an event published by any instance
 * reaches the browsers connected to every instance (each one LISTENs on CHANNEL).
 * Payloads are a few hundred bytes, far below the 8000-byte NOTIFY limit.
 */
const CHANNEL = 'live_events'
/** Local fan-out to this instance's SSE streams. `RESET`: events may have been lost. */
const local = new EventEmitter().setMaxListeners(0)
const RESET = 'reset'

type Envelope = { user_id: string; event: LiveEvent }

let listening: Promise<{ close: () => Promise<void> }> | null = null

function listen() {
  listening ??= createListener({
    databaseUrl: env.DATABASE_URL,
    channel: CHANNEL,
    onPayload: (payload) => {
      const { user_id, event } = JSON.parse(payload) as Envelope
      local.emit(user_id, event)
    },
    onReconnect: () => local.emit(RESET),
  }).catch((err: unknown) => {
    listening = null
    throw err
  })
  return listening
}

/** Sends `event` to the user's browsers, on every instance. */
export async function publish(userId: string, event: LiveEvent) {
  const envelope: Envelope = { user_id: userId, event }
  try {
    await db.execute(sql`SELECT pg_notify(${CHANNEL}, ${JSON.stringify(envelope)})`)
  } catch (err) {
    // Live updates are best effort: never fail the request that stored the data.
    console.error('live event not published', err)
  }
}

/**
 * Calls `listener` with the user's events, from once this resolves. `onReset`: the
 * Postgres connection was lost, events may be missing (the stream should restart).
 * @returns unsubscribe
 */
export async function subscribe(
  userId: string,
  listener: (event: LiveEvent) => void,
  onReset: () => void,
) {
  await listen()
  local.on(userId, listener)
  local.on(RESET, onReset)
  return () => {
    local.off(userId, listener)
    local.off(RESET, onReset)
  }
}

/** Stops listening (shutdown, tests). */
export async function closeLiveEvents() {
  const current = listening
  listening = null
  await (await current)?.close()
}
