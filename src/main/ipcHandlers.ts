import { ipcMain, BrowserWindow } from 'electron'
import type { IStore, Settings } from './store'

export function registerIpcHandlers(
  store: IStore,
  win: BrowserWindow
): void {
  ipcMain.handle('settings:get', () => store.store)

  ipcMain.handle('settings:set', (_e, updates: Partial<Settings>) => {
    for (const [k, v] of Object.entries(updates)) {
      store.set(k, v)
    }
    return store.store
  })

  ipcMain.on('window:minimize', () => win.minimize())
  ipcMain.on('window:close', () => win.close())
  ipcMain.on('window:toggleAlwaysOnTop', () => {
    win.setAlwaysOnTop(!win.isAlwaysOnTop())
    win.webContents.send('window:alwaysOnTopChanged', win.isAlwaysOnTop())
  })
}
