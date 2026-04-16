/// <reference types="vite/client" />

interface ElectronAPI {
  getSettings(): Promise<import('../../main/store').Settings>
  setSettings(updates: Partial<import('../../main/store').Settings>): Promise<import('../../main/store').Settings>
  minimize(): void
  close(): void
  toggleAlwaysOnTop(): void
  onTasksRefresh(cb: (payload: unknown) => void): () => void
  onAlwaysOnTopChanged(cb: (pinned: boolean) => void): () => void
}

interface Window {
  electronAPI: ElectronAPI
}
