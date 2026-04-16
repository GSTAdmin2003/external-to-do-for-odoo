import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { OdooTask, OdooStage, StageMap } from '../lib/odooClient'

export type UIStatus = 'open' | 'inProgress' | 'done'

export type AppSettings = {
  odooUrl: string
  dbName: string
  username: string
  apiKey: string
  webhookPort: number
  webhookBindAll: boolean
  pollInterval: number   // seconds, 0 = disabled
}

const DEFAULT_SETTINGS: AppSettings = {
  odooUrl: '',
  dbName: '',
  username: '',
  apiKey: '',
  webhookPort: 3001,
  webhookBindAll: false,
  pollInterval: 30
}

type State = {
  tasks: OdooTask[]
  stages: OdooStage[]
  stageMap: StageMap | null
settings: AppSettings
  isSettingsOpen: boolean
  isCreateOpen: boolean
  isStagesOpen: boolean
  isSyncing: boolean
  lastSynced: number | null
  error: string | null
  isPinned: boolean
}

type Actions = {
  setTasks: (tasks: OdooTask[]) => void
  updateTask: (id: number, patch: Partial<OdooTask>) => void
  removeTask: (id: number) => void
  setStages: (stages: OdooStage[], map: StageMap) => void
  setSettings: (s: Partial<AppSettings>) => void
  openSettings: () => void
  closeSettings: () => void
  openCreate: () => void
  closeCreate: () => void
  openStages: () => void
  closeStages: () => void
  setSyncing: (v: boolean) => void
  setError: (e: string | null) => void
  setPinned: (v: boolean) => void
  resolveStatus: (task: OdooTask) => UIStatus
}

export const useTaskStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      tasks: [],
      stages: [],
      stageMap: null,
      settings: DEFAULT_SETTINGS,
      isSettingsOpen: false,
      isCreateOpen: false,
      isStagesOpen: false,
      isSyncing: false,
      lastSynced: null,
      error: null,
      isPinned: true,

      setTasks: (tasks) => set({ tasks, lastSynced: Date.now(), error: null }),

      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t))
        })),

      removeTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      setStages: (stages, stageMap) => set({ stages, stageMap }),

      setSettings: (s) =>
        set((prev) => ({ settings: { ...prev.settings, ...s } })),

      openSettings: () => set({ isSettingsOpen: true }),
      closeSettings: () => set({ isSettingsOpen: false }),
      openCreate: () => set({ isCreateOpen: true }),
      closeCreate: () => set({ isCreateOpen: false }),
      openStages: () => set({ isStagesOpen: true }),
      closeStages: () => set({ isStagesOpen: false }),
      setSyncing: (isSyncing) => set({ isSyncing }),
      setError: (error) => set({ error }),
      setPinned: (isPinned) => set({ isPinned }),

      resolveStatus: (task): UIStatus => {
        if (task.state === '1_done') return 'done'
        if (task.state === '01_in_progress') return 'inProgress'
        return 'open'
      }
    }),
    {
      name: 'odoo-todo-store',
      partialize: (s) => ({
        stageMap: s.stageMap,
        isPinned: s.isPinned,
        settings: { ...s.settings, apiKey: '' }
      })
    }
  )
)
