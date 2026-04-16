import { useCallback } from 'react'
import { useTaskStore } from '../store/useTaskStore'
import { writeTask, deleteTask, updatePersonalStage } from '../lib/odooClient'
import type { OdooTask } from '../lib/odooClient'

// Always read fresh state inside callbacks to avoid stale closure bugs
function getCfg() {
  const s = useTaskStore.getState().settings
  return { odooUrl: s.odooUrl, dbName: s.dbName, username: s.username, apiKey: s.apiKey }
}

export function useOdooSync() {
  const STATE_MAP = {
    open:       '01_in_progress',
    inProgress: '1_done',
    done:       '01_in_progress',
  } as const

  const cycleStatus = useCallback(async (task: OdooTask) => {
    const { resolveStatus, updateTask, setError } = useTaskStore.getState()
    const cfg = getCfg()

    const current = resolveStatus(task)
    const nextState = STATE_MAP[current]
    const prevState = task.state

    console.log(`[cycleStatus] task ${task.id}: ${current} → state="${nextState}"`)
    updateTask(task.id, { state: nextState })
    try {
      await writeTask(cfg, task.id, { state: nextState })
      console.log(`[cycleStatus] write OK`)
    } catch (e) {
      console.error('[cycleStatus] write failed:', e)
      updateTask(task.id, { state: prevState })
      setError((e as Error).message)
    }
  }, [])

  const togglePriority = useCallback(async (task: OdooTask) => {
    const { updateTask, setError } = useTaskStore.getState()
    const cfg = getCfg()
    const newPriority: '0' | '1' = task.priority === '1' ? '0' : '1'
    updateTask(task.id, { priority: newPriority })
    try {
      await writeTask(cfg, task.id, { priority: newPriority })
    } catch (e) {
      updateTask(task.id, { priority: task.priority })
      setError((e as Error).message)
    }
  }, [])

  const saveNote = useCallback(async (task: OdooTask, note: string) => {
    const { updateTask, setError } = useTaskStore.getState()
    const cfg = getCfg()
    const prev = task.description
    updateTask(task.id, { description: note })
    try {
      await writeTask(cfg, task.id, { description: note })
    } catch (e) {
      updateTask(task.id, { description: prev })
      setError((e as Error).message)
    }
  }, [])

  const destroyTask = useCallback(async (task: OdooTask) => {
    const { removeTask, updateTask, setError } = useTaskStore.getState()
    const cfg = getCfg()
    removeTask(task.id)
    try {
      await deleteTask(cfg, task.id)
    } catch (e) {
      updateTask(task.id, task)
      setError((e as Error).message)
    }
  }, [])

  const updateStage = useCallback(async (task: OdooTask, stageId: number) => {
    const { updateTask, setError, stages } = useTaskStore.getState()
    const cfg = getCfg()
    const prev = task.personal_stage_type_id
    const stageName = stages.find((s) => s.id === stageId)?.name ?? ''
    updateTask(task.id, { personal_stage_type_id: [stageId, stageName] })
    try {
      await updatePersonalStage(cfg, task.id, stageId)
    } catch (e) {
      updateTask(task.id, { personal_stage_type_id: prev })
      setError((e as Error).message)
    }
  }, [])

  return { cycleStatus, togglePriority, saveNote, destroyTask, updateStage }
}
