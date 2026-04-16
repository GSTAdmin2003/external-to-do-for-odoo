import { join } from 'path'
import { app, BrowserWindow } from 'electron'
import { getWindowOptions } from './windowConfig'
import { registerIpcHandlers } from './ipcHandlers'
import { startWebhookServer } from './webhook'
import { createStore } from './store'

const store = createStore()

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    ...getWindowOptions(),
    webPreferences: {
      ...getWindowOptions().webPreferences,
      preload: join(__dirname, '../preload/index.js')
    }
  })

  registerIpcHandlers(store, win)

  const port = (store.get('webhookPort') as number | undefined) ?? 3001
  const bindAll = (store.get('webhookBindAll') as boolean | undefined) ?? false
  startWebhookServer(port, bindAll, win)

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
