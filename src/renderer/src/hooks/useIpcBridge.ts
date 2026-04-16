import { useEffect, useCallback, useRef } from 'react'
import { useTaskStore } from '../store/useTaskStore'
import { fetchTasks, fetchPersonalStages, buildStageMap, clearSession } from '../lib/odooClient'
import type { AppSettings } from '../store/useTaskStore'

function getCfg(s: AppSettings) {
  return { odooUrl: s.odooUrl, dbName: s.dbName, username: s.username, apiKey: s.apiKey }
}

let refreshInProgress = false
let refreshCount = 0

export async function runRefresh(): Promise<void> {
  const callId = ++refreshCount
  console.log(`[runRefresh #${callId}] called. inProgress=${refreshInProgress}`)
  if (refreshInProgress) {
    console.log(`[runRefresh #${callId}] SKIPPED — already in progress`)
    return
  }
  const store = useTaskStore.getState()
  const { odooUrl, apiKey, dbName, username } = store.settings
  console.log(`[runRefresh #${callId}] settings:`, { odooUrl, dbName, username, hasKey: !!apiKey })
  if (!odooUrl || !apiKey || !dbName || !username) {
    console.log(`[runRefresh #${callId}] SKIPPED — missing settings`)
    return
  }

  refreshInProgress = true
  store.setSyncing(true)
  store.setError(null)
  console.log(`[runRefresh #${callId}] starting fetch...`)
  try {
    const cfg = getCfg(store.settings)
    console.log(`[runRefresh #${callId}] fetching tasks...`)
    const [tasks, stages] = await Promise.all([
      fetchTasks(cfg),
      fetchPersonalStages(cfg)
    ])
    const stageMap = buildStageMap(stages)
    console.log(`[runRefresh #${callId}] got ${tasks.length} tasks, ${stages.length} stages`)
    console.log(`[runRefresh #${callId}] stages:`, stages.map(s => `${s.id}:${s.name}(fold=${s.fold})`))
    console.log(`[runRefresh #${callId}] stageMap:`, stageMap)
    store.setStages(stages, stageMap)
    store.setTasks(tasks)
    console.log(`[runRefresh #${callId}] store updated — done`)
  } catch (e) {
    console.error(`[runRefresh #${callId}] ERROR:`, e)
    store.setError((e as Error).message)
  } finally {
    refreshInProgress = false
    store.setSyncing(false)
    console.log(`[runRefresh #${callId}] finally block — inProgress reset`)
  }
}

export function useIpcBridge(): void {
  useEffect(() => {
    console.log('[useIpcBridge] mounting, loading settings...')
    window.electronAPI.getSettings().then((s) => {
      console.log('[useIpcBridge] settings loaded from electron-store:', { ...s, apiKey: s.apiKey ? '***' : '' })
      useTaskStore.getState().setSettings(s)
      runRefresh()
    })

    const cleanupRefresh = window.electronAPI.onTasksRefresh(() => {
      console.log('[useIpcBridge] tasks:refresh IPC received')
      runRefresh()
    })
    const cleanupPin = window.electronAPI.onAlwaysOnTopChanged(
      (pinned) => useTaskStore.getState().setPinned(pinned)
    )

    return () => {
      cleanupRefresh()
      cleanupPin()
    }
  }, [])

  // Polling: subscribes to pollInterval from store
  const pollInterval = useTaskStore((s) => s.settings.pollInterval)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (!pollInterval || pollInterval < 5) return

    console.log(`[useIpcBridge] polling every ${pollInterval}s`)
    pollRef.current = setInterval(() => runRefresh(), pollInterval * 1000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [pollInterval])
}

export function useRefresh(): () => void {
  return useCallback(() => { runRefresh() }, [])
}

export function useSaveSettings(): (s: AppSettings) => Promise<void> {
  return useCallback(async (s: AppSettings) => {
    await window.electronAPI.setSettings(s)
    useTaskStore.getState().setSettings(s)
    clearSession()  // force re-auth with new credentials
    runRefresh()
  }, [])
}
