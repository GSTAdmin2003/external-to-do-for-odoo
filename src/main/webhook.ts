import express from 'express'
import type { BrowserWindow } from 'electron'
import type { Server } from 'http'

let server: Server | null = null

export function startWebhookServer(
  port: number,
  bindAll: boolean,
  win: BrowserWindow
): void {
  const app = express()
  app.use(express.json())

  app.post('/webhook', (req, res) => {
    console.log('[webhook] received', JSON.stringify(req.body))
    win.webContents.send('tasks:refresh', req.body)
    res.sendStatus(200)
  })

  app.get('/health', (_req, res) => {
    res.json({ ok: true })
  })

  const host = bindAll ? '0.0.0.0' : '127.0.0.1'
  server = app.listen(port, host, () => {
    console.log(`[webhook] listening on http://${host}:${port}`)
  })

  server.on('error', (err) => {
    console.error('[webhook] server error:', err)
  })
}

export function stopWebhookServer(): void {
  if (server) {
    server.close()
    server = null
  }
}
