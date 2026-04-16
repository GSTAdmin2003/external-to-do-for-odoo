import { BrowserWindowConstructorOptions } from 'electron'

export function getWindowOptions(): BrowserWindowConstructorOptions {
  return {
    width: 520,
    height: 680,
    minWidth: 400,
    minHeight: 400,
    frame: false,
    transparent: false,
    backgroundColor: '#10101a',
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    hasShadow: true,
    webPreferences: {
      webSecurity: false,   // allows renderer to fetch Odoo without CORS restrictions
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  }
}
