import { join } from 'path'
import { app, BrowserWindow } from 'electron'
import { getWindowOptions } from './windowConfig'
import { registerIpcHandlers } from './ipcHandlers'
import { startWebhookServer } from './webhook'
import { createStore } from './store'

const PROTOCOL = 'odootodo'
const store = createStore()
let mainWin: BrowserWindow | null = null

// Enforce single instance — required for deep link handling when app is already open
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  // Second instance was launched (e.g. user clicked deep link while app was running)
  app.on('second-instance', (_event, argv) => {
    const url = findProtocolUrl(argv)
    if (url) applyDeepLink(url)
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore()
      mainWin.show()
      mainWin.focus()
    }
  })
}

function findProtocolUrl(argv: string[]): string | null {
  return argv.find((arg) => arg.startsWith(`${PROTOCOL}://`)) ?? null
}

function applyDeepLink(url: string): void {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 'setup') return

    const odooUrl  = parsed.searchParams.get('url')
    const dbName   = parsed.searchParams.get('db')
    const username = parsed.searchParams.get('user')
    const apiKey   = parsed.searchParams.get('key')

    if (!odooUrl || !dbName || !username || !apiKey) return

    store.set('odooUrl',  odooUrl)
    store.set('dbName',   dbName)
    store.set('username', username)
    store.set('apiKey',   apiKey)

    mainWin?.webContents.send('deeplink:config', { odooUrl, dbName, username, apiKey })
  } catch {
    // malformed URL — ignore
  }
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    ...getWindowOptions(),
    webPreferences: {
      ...getWindowOptions().webPreferences,
      preload: join(__dirname, '../preload/index.js')
    }
  })

  mainWin = win
  registerIpcHandlers(store, win)

  const port    = (store.get('webhookPort')    as number  | undefined) ?? 3001
  const bindAll = (store.get('webhookBindAll') as boolean | undefined) ?? false
  startWebhookServer(port, bindAll, win)

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

// Register protocol before app is ready (required on Windows)
app.setAsDefaultProtocolClient(PROTOCOL)

app.whenReady().then(() => {
  const win = createWindow()

  // Cold launch with deep link (Linux / Windows pass URL in argv)
  const url = findProtocolUrl(process.argv)
  if (url) {
    // Wait for renderer to finish loading before sending the IPC message
    win.webContents.once('did-finish-load', () => applyDeepLink(url))
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// macOS delivers deep links via open-url (app may already be running)
app.on('open-url', (_event, url) => {
  if (mainWin) {
    mainWin.show()
    mainWin.focus()
    applyDeepLink(url)
  } else {
    app.once('browser-window-created', (_, win) => {
      win.webContents.once('did-finish-load', () => applyDeepLink(url))
    })
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
