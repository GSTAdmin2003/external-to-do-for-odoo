import React, { useState, useRef, useEffect } from 'react'
import { useTaskStore } from '../store/useTaskStore'
import { fetchPersonalStages, fetchStagesByIds, createPersonalStage, renameStage, archiveStage, archiveTasksInStage, unarchiveStage, unarchiveTasksInStage } from '../lib/odooClient'
import type { OdooStage } from '../lib/odooClient'
import { runRefresh } from '../hooks/useIpcBridge'

export default function StagesPanel(): React.ReactElement {
  const { closeStages, settings, tasks } = useTaskStore()
  const [allStages, setAllStages] = useState<OdooStage[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const editInputRef = useRef<HTMLInputElement>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  const cfg = {
    odooUrl: settings.odooUrl,
    dbName: settings.dbName,
    username: settings.username,
    apiKey: settings.apiKey
  }

  useEffect(() => {
    setLoading(true)
    setConfirmingId(null)
    setEditingId(null)
    fetchPersonalStages(cfg, showArchived)
      .then(setAllStages)
      .finally(() => setLoading(false))
  }, [showArchived])

  useEffect(() => {
    if (editingId !== null) editInputRef.current?.focus()
  }, [editingId])

  useEffect(() => {
    if (adding) addInputRef.current?.focus()
  }, [adding])

  function startEdit(id: number, name: string): void {
    setConfirmingId(null)
    setEditingId(id)
    setEditingName(name)
  }

  function cancelEdit(): void {
    setEditingId(null)
    setEditingName('')
  }

  async function saveEdit(): Promise<void> {
    if (editingId === null) return
    const trimmed = editingName.trim()
    const original = allStages.find(s => s.id === editingId)?.name ?? ''
    if (!trimmed || trimmed === original) { cancelEdit(); return }
    setBusy(true)
    try {
      await renameStage(cfg, editingId, trimmed)
      setEditingId(null)
      const updated = await fetchPersonalStages(cfg, showArchived)
      setAllStages(updated)
      runRefresh()
    } finally {
      setBusy(false)
    }
  }

  async function doArchive(id: number): Promise<void> {
    setBusy(true)
    try {
      const taskIds = tasks
        .filter((t) => t.personal_stage_type_id && t.personal_stage_type_id[0] === id)
        .map((t) => t.id)
      await archiveStage(cfg, id)
      await archiveTasksInStage(cfg, id, taskIds)
      setConfirmingId(null)
      const updated = await fetchPersonalStages(cfg, showArchived)
      setAllStages(updated)
      runRefresh()
    } finally {
      setBusy(false)
    }
  }

  async function doUnarchive(id: number): Promise<void> {
    setBusy(true)
    try {
      await unarchiveStage(cfg, id)
      await unarchiveTasksInStage(cfg, id)
      setConfirmingId(null)
      const updated = await fetchPersonalStages(cfg, showArchived)
      setAllStages(updated)
      runRefresh()
    } finally {
      setBusy(false)
    }
  }

  async function doAdd(): Promise<void> {
    const trimmed = newName.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      const newId = await createPersonalStage(cfg, trimmed)
      setNewName('')
      setAdding(false)
      // New stage has no tasks yet — task-based fetch would miss it, so read it directly
      const created = await fetchStagesByIds(cfg, [newId])
      if (created.length > 0) {
        setAllStages((prev) => [...prev, created[0]].sort((a, b) => a.sequence - b.sequence))
      }
      runRefresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sp">
      <div className="sp__header">
        <span className="sp__title">Stages</span>
        <button
          className={`sp__archive-toggle ${showArchived ? 'archived' : 'active'}`}
          onClick={() => setShowArchived((v) => !v)}
          title={showArchived ? 'Showing archived — click for active' : 'Showing active — click for archived'}
        >
          {showArchived ? '●' : '◑'}
        </button>
        <button className="sp__close" onClick={closeStages} title="Close">✕</button>
      </div>

      <div className="sp__body">
        {loading && <div className="sp__empty">Loading…</div>}
        {!loading && allStages.length === 0 && (
          <div className="sp__empty">No personal stages found</div>
        )}
        {allStages.map((stage) => (
          <div key={stage.id} className={`sp__row ${editingId === stage.id ? 'sp__row--editing' : ''}`}>
            {editingId === stage.id ? (
              <input
                ref={editInputRef}
                className="sp__edit-input"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit()
                  if (e.key === 'Escape') cancelEdit()
                }}
                onBlur={saveEdit}
                disabled={busy}
              />
            ) : (
              <span
                className="sp__name"
                onClick={() => startEdit(stage.id, stage.name)}
                title="Click to rename"
              >
                {stage.name}
              </span>
            )}

            {editingId !== stage.id && (
              confirmingId === stage.id ? (
                <div className="sp__confirm">
                  <span className="sp__confirm-label">{showArchived ? 'Unarchive?' : 'Archive?'}</span>
                  <button
                    className={`sp__confirm-yes ${showArchived ? 'unarchive' : ''}`}
                    onClick={() => showArchived ? doUnarchive(stage.id) : doArchive(stage.id)}
                    disabled={busy}
                  >
                    Yes
                  </button>
                  <button
                    className="sp__confirm-no"
                    onClick={() => setConfirmingId(null)}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  className={`sp__archive-btn ${showArchived ? 'unarchive' : ''}`}
                  onClick={() => { cancelEdit(); setConfirmingId(stage.id) }}
                  title={showArchived ? 'Unarchive stage' : 'Archive stage'}
                >
                  {showArchived ? 'Restore' : 'Archive'}
                </button>
              )
            )}
          </div>
        ))}
      </div>

      {!showArchived && <div className="sp__footer">
        {adding ? (
          <div className="sp__add-row">
            <input
              ref={addInputRef}
              className="sp__add-input"
              placeholder="Stage name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') doAdd()
                if (e.key === 'Escape') { setAdding(false); setNewName('') }
              }}
              disabled={busy}
            />
            <button
              className="sp__add-confirm"
              onClick={doAdd}
              disabled={busy || !newName.trim()}
            >
              Add
            </button>
            <button
              className="sp__add-cancel"
              onClick={() => { setAdding(false); setNewName('') }}
            >
              ✕
            </button>
          </div>
        ) : (
          <button className="sp__add-btn" onClick={() => setAdding(true)}>
            + Add Stage
          </button>
        )}
      </div>}

      <style>{`
        .sp {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
        }
        .sp__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
        }
        .sp__title {
          font-size: 12px;
          font-weight: 600;
          opacity: 0.8;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .sp__archive-toggle {
          font-size: 13px;
          width: 24px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          border: 1px solid transparent;
          opacity: 0.45;
          transition: opacity 0.15s, background 0.15s, border-color 0.15s;
        }
        .sp__archive-toggle:hover { opacity: 0.85; background: rgba(255,255,255,0.07); }
        .sp__archive-toggle.active {
          opacity: 0.9;
          color: #a8d1ff;
          background: rgba(110,168,254,0.12);
          border-color: rgba(110,168,254,0.25);
        }
        .sp__archive-toggle.archived {
          opacity: 0.9;
          color: #80e0a0;
          background: rgba(80,200,120,0.12);
          border-color: rgba(80,200,120,0.25);
        }
        .sp__close {
          font-size: 11px;
          opacity: 0.4;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: opacity 0.15s, background 0.15s;
        }
        .sp__close:hover {
          opacity: 1;
          background: rgba(255,80,80,0.25);
        }
        .sp__body {
          flex: 1;
          overflow-y: auto;
          padding: 6px 0;
        }
        .sp__empty {
          font-size: 11.5px;
          opacity: 0.35;
          text-align: center;
          padding: 20px 0;
        }
        .sp__row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          height: 34px;
          gap: 8px;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          transition: background 0.1s;
        }
        .sp__row:last-child { border-bottom: none; }
        .sp__row:hover { background: rgba(255,255,255,0.03); }
        .sp__row--editing { background: rgba(255,255,255,0.04); }
        .sp__name {
          flex: 1;
          font-size: 12.5px;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          opacity: 0.85;
        }
        .sp__name:hover { opacity: 1; }
        .sp__edit-input {
          flex: 1;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(110,168,254,0.4);
          border-radius: 4px;
          padding: 3px 7px;
          font-size: 12.5px;
          color: #e2e2e8;
        }
        .sp__edit-input:focus { outline: none; border-color: rgba(110,168,254,0.7); }
        .sp__archive-btn {
          font-size: 11px;
          padding: 3px 8px;
          border: 1px solid rgba(255,80,80,0.3);
          border-radius: 4px;
          color: rgba(255,120,120,0.7);
          white-space: nowrap;
          flex-shrink: 0;
          transition: background 0.12s, color 0.12s, border-color 0.12s;
        }
        .sp__archive-btn:hover {
          background: rgba(255,60,60,0.15);
          color: #ff8080;
          border-color: rgba(255,80,80,0.6);
        }
        .sp__archive-btn.unarchive {
          border-color: rgba(80,200,120,0.3);
          color: rgba(100,220,140,0.7);
        }
        .sp__archive-btn.unarchive:hover {
          background: rgba(60,200,100,0.15);
          color: #80e0a0;
          border-color: rgba(80,200,120,0.6);
        }
        .sp__confirm-yes.unarchive {
          border-color: rgba(80,200,120,0.5);
          color: #80e0a0;
        }
        .sp__confirm-yes.unarchive:hover { background: rgba(60,200,100,0.2); }
        .sp__confirm {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-shrink: 0;
        }
        .sp__confirm-label {
          font-size: 11px;
          opacity: 0.55;
        }
        .sp__confirm-yes {
          font-size: 11px;
          padding: 2px 7px;
          border: 1px solid rgba(255,80,80,0.5);
          border-radius: 4px;
          color: #ff8080;
          transition: background 0.12s;
        }
        .sp__confirm-yes:hover { background: rgba(255,60,60,0.2); }
        .sp__confirm-yes:disabled { opacity: 0.4; cursor: default; }
        .sp__confirm-no {
          font-size: 11px;
          padding: 2px 7px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 4px;
          opacity: 0.55;
          transition: background 0.12s, opacity 0.12s;
        }
        .sp__confirm-no:hover { opacity: 1; background: rgba(255,255,255,0.07); }
        .sp__footer {
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 8px 12px;
          flex-shrink: 0;
        }
        .sp__add-btn {
          font-size: 11.5px;
          opacity: 0.5;
          padding: 4px 0;
          width: 100%;
          text-align: left;
          transition: opacity 0.15s;
        }
        .sp__add-btn:hover { opacity: 1; }
        .sp__add-row {
          display: flex;
          gap: 5px;
          align-items: center;
        }
        .sp__add-input {
          flex: 1;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 12px;
          color: #e2e2e8;
          min-width: 0;
          transition: border-color 0.15s;
        }
        .sp__add-input:focus {
          outline: none;
          border-color: rgba(110,168,254,0.5);
          background: rgba(255,255,255,0.08);
        }
        .sp__add-confirm {
          font-size: 11px;
          padding: 4px 10px;
          background: rgba(110,168,254,0.15);
          border: 1px solid rgba(110,168,254,0.35);
          border-radius: 4px;
          color: #a8d1ff;
          white-space: nowrap;
          flex-shrink: 0;
          transition: background 0.12s;
        }
        .sp__add-confirm:hover:not(:disabled) { background: rgba(110,168,254,0.28); }
        .sp__add-confirm:disabled { opacity: 0.35; cursor: default; }
        .sp__add-cancel {
          font-size: 10px;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.4;
          border-radius: 4px;
          flex-shrink: 0;
          transition: opacity 0.12s, background 0.12s;
        }
        .sp__add-cancel:hover { opacity: 1; background: rgba(255,255,255,0.07); }
      `}</style>
    </div>
  )
}
