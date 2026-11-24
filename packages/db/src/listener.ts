import { Client } from 'pg'

type Options = {
  databaseUrl: string
  channel: string
  onPayload: (payload: string) => void
  /** Connection lost then back: notifications sent meanwhile are lost. */
  onReconnect?: () => void
}

const RETRY_MS = 1_000

/**
 * Postgres LISTEN on a dedicated connection (a pooled one would drop it), reconnecting when
 * the connection is lost. Resolves once listening.
 */
export async function createListener({ databaseUrl, channel, onPayload, onReconnect }: Options) {
  let client: Client | null = null
  let closed = false
  let retry: ReturnType<typeof setTimeout> | undefined

  async function connect() {
    const c = new Client({ connectionString: databaseUrl })
    c.on('notification', (msg) => {
      if (msg.channel === channel && msg.payload !== undefined) onPayload(msg.payload)
    })
    const lost = () => {
      if (closed || client !== c) return
      client = null
      c.end().catch(() => undefined)
      retry = setTimeout(reconnect, RETRY_MS)
    }
    c.on('error', lost)
    c.on('end', lost)
    await c.connect()
    await c.query(`LISTEN "${channel.replaceAll('"', '""')}"`)
    client = c
  }

  async function reconnect() {
    try {
      await connect()
      onReconnect?.()
    } catch {
      if (!closed) retry = setTimeout(reconnect, RETRY_MS)
    }
  }

  await connect()
  return {
    async close() {
      closed = true
      clearTimeout(retry)
      await client?.end()
      client = null
    },
  }
}
