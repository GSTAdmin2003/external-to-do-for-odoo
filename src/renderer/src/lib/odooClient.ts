export type OdooTask = {
  id: number
  name: string
  date_deadline: string | false
  create_date: string | false
  description: string | false
  state: string | false
  personal_stage_type_id: false | [number, string]  // current user's personal stage
  personal_stage_type_ids: number[]
  priority: '0' | '1'
  user_ids: number[]
  project_id: false | [number, string]
}

export type OdooStage = {
  id: number
  name: string
  sequence: number
  fold: boolean
  active?: boolean
}

export type StageMap = {
  open: number
  inProgress: number
  done: number
}

export type OdooConfig = {
  odooUrl: string
  dbName: string
  username: string
  apiKey: string
}

const TASK_FIELDS = [
  'id', 'name', 'date_deadline', 'create_date', 'description',
  'state', 'personal_stage_type_id', 'personal_stage_type_ids', 'priority', 'user_ids', 'project_id'
]

// UID cache — no sessions, no cookies
let cachedUid: number | null = null
let cachedCfgKey = ''
let uidPromise: Promise<number> | null = null

export function clearSession(): void {
  cachedUid = null
  cachedCfgKey = ''
}

function cfgKey(cfg: OdooConfig): string {
  return `${cfg.odooUrl}|${cfg.dbName}|${cfg.username}|${cfg.apiKey}`
}

function fetchWithTimeout(url: string, options: RequestInit, ms = 15000): Promise<Response> {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(id))
}

// Uses /jsonrpc common.authenticate — returns uid, no cookies
async function doGetUid(cfg: OdooConfig): Promise<number> {
  const url = `${cfg.odooUrl.replace(/\/$/, '')}/jsonrpc`
  console.log('[odoo] authenticate via /jsonrpc common.authenticate')
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'call', id: 1,
      params: {
        service: 'common',
        method: 'authenticate',
        args: [cfg.dbName, cfg.username, cfg.apiKey, {}]
      }
    })
  })
  console.log('[odoo] authenticate: HTTP', res.status)

  let json: any
  try { json = await res.json() } catch {
    const text = await res.text().catch(() => '(unreadable)')
    throw new Error(`Auth response not JSON (HTTP ${res.status}): ${text.slice(0, 100)}`)
  }

  if (json.error) throw new Error(json.error.data?.message ?? json.error.message ?? 'Auth failed')
  if (!json.result) throw new Error('Authentication failed — check your username and password')

  console.log('[odoo] authenticate: success, uid=', json.result)
  return json.result as number
}

// Serialize concurrent uid fetches
async function getUid(cfg: OdooConfig): Promise<number> {
  const key = cfgKey(cfg)
  if (cachedUid && key === cachedCfgKey) return cachedUid

  if (!uidPromise) {
    uidPromise = doGetUid(cfg)
      .then(uid => { cachedUid = uid; cachedCfgKey = key; return uid })
      .finally(() => { uidPromise = null })
  } else {
    console.log('[odoo] uid fetch: waiting for in-flight auth...')
  }
  return uidPromise
}

// Uses /jsonrpc object.execute_kw — uid+password per call, no session needed
async function executeKw<T>(
  cfg: OdooConfig,
  model: string,
  method: string,
  args: unknown[],
  kwargs: Record<string, unknown>
): Promise<T> {
  const uid = await getUid(cfg)
  console.log(`[odoo] executeKw: ${model}.${method} (uid=${uid})`)

  const url = `${cfg.odooUrl.replace(/\/$/, '')}/jsonrpc`
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'call', id: 1,
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [cfg.dbName, uid, cfg.apiKey, model, method, args, kwargs]
      }
    })
  })
  console.log(`[odoo] executeKw ${model}.${method}: HTTP ${res.status}`)

  let json: any
  try { json = await res.json() } catch {
    const text = await res.text().catch(() => '(unreadable)')
    throw new Error(`RPC response not JSON (HTTP ${res.status}): ${text.slice(0, 100)}`)
  }

  if (json.error) {
    const msg = json.error.data?.message ?? json.error.message ?? 'Odoo RPC error'
    console.error(`[odoo] executeKw error:`, msg)
    // If auth failed, clear uid cache and retry once
    if (json.error.code === 100 || json.error.code === 300 || /access|auth|session/i.test(msg)) {
      console.log('[odoo] clearing uid cache and retrying...')
      clearSession()
      const uid2 = await getUid(cfg)
      const res2 = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', method: 'call', id: 1,
          params: {
            service: 'object',
            method: 'execute_kw',
            args: [cfg.dbName, uid2, cfg.apiKey, model, method, args, kwargs]
          }
        })
      })
      const json2 = await res2.json()
      if (json2.error) throw new Error(json2.error.data?.message ?? json2.error.message ?? 'Odoo RPC error')
      return json2.result as T
    }
    throw new Error(msg)
  }

  console.log(`[odoo] executeKw ${model}.${method}: OK, got`, Array.isArray(json.result) ? json.result.length + ' records' : typeof json.result)
  return json.result as T
}

export async function fetchTasks(cfg: OdooConfig): Promise<OdooTask[]> {
  const uid = await getUid(cfg)
  return executeKw<OdooTask[]>(cfg, 'project.task', 'search_read',
    [[['project_id', '=', false], ['user_ids', 'in', [uid]]]],
    { fields: TASK_FIELDS, order: 'date_deadline asc, id asc', limit: 500 }
  )
}

export async function fetchPersonalStages(cfg: OdooConfig, showArchived = false): Promise<OdooStage[]> {
  const uid = await getUid(cfg)

  if (showArchived) {
    // Directly search archived personal stages (no project link) with active_test disabled
    return executeKw<OdooStage[]>(
      cfg, 'project.task.type', 'search_read',
      [[['active', '=', false], ['project_ids', '=', false]]],
      { fields: ['id', 'name', 'sequence', 'fold', 'active'], order: 'sequence asc', context: { active_test: false } }
    )
  }

  // Two sources in parallel:
  // 1. Stage IDs from user's tasks (stages that have tasks assigned)
  // 2. Stages created by this user (includes empty stages with no tasks yet)
  const [tasks, createdStages] = await Promise.all([
    executeKw<{ personal_stage_type_ids: number[] }[]>(
      cfg, 'project.task', 'search_read',
      [[['user_ids', 'in', [uid]], ['project_id', '=', false]]],
      { fields: ['personal_stage_type_ids'], limit: 1000 }
    ),
    executeKw<OdooStage[]>(
      cfg, 'project.task.type', 'search_read',
      [[['create_uid', '=', uid], ['project_ids', '=', false]]],
      { fields: ['id', 'name', 'sequence', 'fold'], order: 'sequence asc' }
    )
  ])

  const createdIds = new Set(createdStages.map((s) => s.id))
  const taskStageIds = tasks.flatMap((t) => t.personal_stage_type_ids).filter((id) => !createdIds.has(id))
  const extraIds = [...new Set(taskStageIds)]

  if (extraIds.length === 0) return createdStages
  const extraStages = await fetchStagesByIds(cfg, extraIds)
  return [...createdStages, ...extraStages].sort((a, b) => a.sequence - b.sequence)
}

export async function fetchStagesByIds(cfg: OdooConfig, ids: number[]): Promise<OdooStage[]> {
  if (ids.length === 0) return []
  const stages = await executeKw<OdooStage[]>(cfg, 'project.task.type', 'read',
    [ids],
    { fields: ['id', 'name', 'sequence', 'fold'] }
  )
  return stages.sort((a, b) => a.sequence - b.sequence)
}

export async function createPersonalStage(cfg: OdooConfig, name: string): Promise<number> {
  return executeKw<number>(cfg, 'project.task.type', 'create',
    [{ name }], {}
  )
}

export async function renameStage(cfg: OdooConfig, id: number, name: string): Promise<boolean> {
  return executeKw<boolean>(cfg, 'project.task.type', 'write', [[id], { name }], {})
}

export async function archiveStage(cfg: OdooConfig, id: number): Promise<boolean> {
  return executeKw<boolean>(cfg, 'project.task.type', 'write', [[id], { active: false }], {})
}

export async function unarchiveStage(cfg: OdooConfig, id: number): Promise<boolean> {
  return executeKw<boolean>(cfg, 'project.task.type', 'write', [[id], { active: true }], { context: { active_test: false } })
}

export async function unarchiveTasksInStage(cfg: OdooConfig, stageId: number): Promise<void> {
  const uid = await getUid(cfg)
  // Search among archived tasks (active_test: false) for this user in this stage
  const taskIds = await executeKw<number[]>(
    cfg, 'project.task', 'search',
    [[['personal_stage_type_ids', 'in', [stageId]], ['user_ids', 'in', [uid]], ['project_id', '=', false], ['active', '=', false]]],
    { limit: 500, context: { active_test: false } }
  )
  if (taskIds.length === 0) return
  await executeKw<boolean>(cfg, 'project.task', 'write', [taskIds, { active: true }], { context: { active_test: false } })
}

export function buildStageMap(stages: OdooStage[]): StageMap {
  if (stages.length === 0) return { open: 0, inProgress: 0, done: 0 }

  const sorted = [...stages].sort((a, b) => a.sequence - b.sequence)
  const doneStage = stages.find(s => s.fold)
    ?? stages.find(s => /done|closed|complet|finish/i.test(s.name))
  const inProgressStage = stages.find(s =>
    !s.fold && /progress|doing|ongoing|active|in.?work|started/i.test(s.name)
  )
  const openStage = sorted.find(
    s => !s.fold && s.id !== doneStage?.id && s.id !== inProgressStage?.id
  ) ?? sorted[0]

  if (!doneStage && !inProgressStage) {
    if (sorted.length === 1) return { open: sorted[0].id, inProgress: sorted[0].id, done: sorted[0].id }
    if (sorted.length === 2) return { open: sorted[0].id, inProgress: sorted[0].id, done: sorted[1].id }
    return { open: sorted[0].id, inProgress: sorted[1].id, done: sorted[sorted.length - 1].id }
  }

  return {
    open: openStage?.id ?? sorted[0].id,
    inProgress: inProgressStage?.id ?? openStage?.id ?? sorted[0].id,
    done: doneStage?.id ?? sorted[sorted.length - 1].id
  }
}

export async function deleteTask(cfg: OdooConfig, id: number): Promise<boolean> {
  return executeKw<boolean>(cfg, 'project.task', 'write', [[id], { active: false }], {})
}

export async function archiveTasksInStage(cfg: OdooConfig, stageId: number, taskIds: number[]): Promise<void> {
  if (taskIds.length === 0) return
  await executeKw<boolean>(cfg, 'project.task', 'write', [taskIds, { active: false }], {})
}

// personal_stage_type_id has an inverse method in Odoo — a single write is sufficient
export async function updatePersonalStage(cfg: OdooConfig, taskId: number, stageId: number): Promise<void> {
  await executeKw<boolean>(cfg, 'project.task', 'write', [[taskId], { personal_stage_type_id: stageId }], {})
}

export async function createTask(
  cfg: OdooConfig,
  values: { name: string; date_deadline?: string; priority?: '0' | '1'; description?: string }
): Promise<number> {
  const uid = await getUid(cfg)
  return executeKw<number>(cfg, 'project.task', 'create', [{
    ...values,
    project_id: false,
    user_ids: [[4, uid]]
  }], {})
}

export async function writeTask(
  cfg: OdooConfig,
  id: number,
  values: {
    state?: string
    priority?: '0' | '1'
    description?: string | false
    name?: string
  }
): Promise<boolean> {
  return executeKw<boolean>(cfg, 'project.task', 'write', [[id], values], {})
}
