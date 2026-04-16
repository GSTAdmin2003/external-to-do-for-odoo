import { contextBridge, ipcRenderer } from 'electron'
import type { Settings } from '../main/store'

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: (): Promise<Settings> =>
    ipcRenderer.invoke('settings:get'),

  setSettings: (updates: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke('settings:set', updates),

  minimize: (): void => ipcRenderer.send('window:minimize'),
  close: (): void => ipcRenderer.send('window:close'),
  toggleAlwaysOnTop: (): void => ipcRenderer.send('window:toggleAlwaysOnTop'),

  onTasksRefresh: (cb: (payload: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown): void => cb(payload)
    ipcRenderer.on('tasks:refresh', listener)
    return () => ipcRenderer.removeListener('tasks:refresh', listener)
  },

  onAlwaysOnTopChanged: (cb: (pinned: boolean) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, pinned: boolean): void => cb(pinned)
    ipcRenderer.on('window:alwaysOnTopChanged', listener)
    return () => ipcRenderer.removeListener('window:alwaysOnTopChanged', listener)
  },

  onDeepLink: (cb: (config: { odooUrl: string; dbName: string; username: string; apiKey: string }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, config: { odooUrl: string; dbName: string; username: string; apiKey: string }): void => cb(config)
    ipcRenderer.on('deeplink:config', listener)
    return () => ipcRenderer.removeListener('deeplink:config', listener)
  }
})
