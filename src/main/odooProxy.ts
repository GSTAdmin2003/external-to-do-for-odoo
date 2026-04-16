import type { IStore } from './store'

// In-memory session cache
let sessionId: string | null = null
let sessionStore: IStore | null = null

export function initProxy(store: IStore): void {
  sessionStore = store
}

export function clearSession(): void {
  sessionId = null
}

async function authenticate(): Promise<void> {
  const s = sessionStore!.store
  if (!s.odooUrl || !s.username || !s.apiKey) {
    throw new Error('Missing Odoo connection settings')
  }

  const url = `${s.odooUrl.replace(/\/$/, '')}/web/session/authenticate`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      id: 1,
      params: {
        db: s.dbName,
        login: s.username,
        password: s.apiKey   // Odoo 14+ accepts API key as password
      }
    })
  })

  const text = await res.text()
  let json: any
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`Odoo returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }

  if (json.error) {
    throw new Error(json.error.data?.message ?? json.error.message ?? 'Authentication failed')
  }
  if (!json.result?.uid) {
    throw new Error('Authentication failed: invalid credentials')
  }

  // session_id is in the response body
  sessionId = json.result.session_id
  console.log('[odoo] authenticated, uid:', json.result.uid)
}

export async function odooCallKw(
  model: string,
  method: string,
  args: unknown[],
  kwargs: Record<string, unknown>
): Promise<unknown> {
  if (!sessionId) await authenticate()

  const s = sessionStore!.store
  const url = `${s.odooUrl.replace(/\/$/, '')}/web/dataset/call_kw`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      id: 1,
      params: { model, method, args, kwargs }
    })
  })

  const text = await res.text()
  let json: any
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`Odoo returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }

  if (json.error) {
    // Session expired — re-authenticate once and retry
    if (json.error.code === 100 || json.error.code === 300) {
      sessionId = null
      await authenticate()
      return odooCallKw(model, method, args, kwargs)
    }
    throw new Error(json.error.data?.message ?? json.error.message ?? 'Odoo RPC error')
  }

  return json.result
}
