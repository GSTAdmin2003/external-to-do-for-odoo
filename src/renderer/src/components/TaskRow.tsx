import React, { useState } from 'react'
import StatusCircle from './StatusCircle'
import StarToggle from './StarToggle'
import NoteCell from './NoteCell'
import { useTaskStore } from '../store/useTaskStore'
import { useOdooSync } from '../hooks/useOdooSync'
import type { OdooTask } from '../lib/odooClient'


type Props = {
  task: OdooTask
}

export default function TaskRow({ task }: Props): React.ReactElement {
  const [expanded, setExpanded] = useState(false)
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const resolveStatus = useTaskStore((s) => s.resolveStatus)
  const stages = useTaskStore((s) => s.stages)
  const { cycleStatus, togglePriority, saveNote, destroyTask, updateStage } = useOdooSync()
  const status = resolveStatus(task)
  const currentStageId = task.personal_stage_type_id ? task.personal_stage_type_id[0] : null

  return (
    <div className={`task-row task-row--${status} ${expanded ? 'task-row--expanded' : ''}`}>
      {/* Main row: status + name + star */}
      <div className="task-row__main" onClick={() => setExpanded((e) => !e)}>
        <div className="task-row__status" onClick={(e) => { e.stopPropagation(); cycleStatus(task) }}>
          <StatusCircle status={status} onClick={() => {}} />
        </div>
        <span className="task-row__name" title={task.name}>{task.name}</span>
        <div className="task-row__star" onClick={(e) => { e.stopPropagation(); togglePriority(task) }}>
          <StarToggle active={task.priority === '1'} onClick={() => {}} />
        </div>
        <span className="task-row__chevron">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="task-row__note" onClick={(e) => e.stopPropagation()}>
          <NoteCell
            value={task.description}
            onSave={(note) => saveNote(task, note)}
          />
          <div className="task-row__meta-row">
            {stages.length > 0 && (
              <select
                className="task-row__stage-select"
                value={currentStageId ?? ''}
                onChange={(e) => updateStage(task, Number(e.target.value))}
              >
                <option value="" disabled>Stage…</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            {confirmingArchive ? (
              <div className="task-row__confirm">
                <span className="task-row__confirm-label">Archive?</span>
                <button className="task-row__confirm-yes" onClick={() => { setConfirmingArchive(false); destroyTask(task) }}>Yes</button>
                <button className="task-row__confirm-no" onClick={() => setConfirmingArchive(false)}>No</button>
              </div>
            ) : (
              <button className="task-row__delete" onClick={() => setConfirmingArchive(true)}>
                Archive
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`
        .task-row {
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: background 0.1s;
        }
        .task-row:last-child { border-bottom: none; }
        .task-row--done .task-row__name {
          opacity: 0.4;
          text-decoration: line-through;
          text-decoration-color: rgba(255,255,255,0.3);
        }
        .task-row__main {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 10px 7px 10px;
          cursor: pointer;
          min-height: 34px;
          user-select: none;
        }
        .task-row__main:hover { background: rgba(255,255,255,0.03); }
        .task-row--expanded .task-row__main { background: rgba(255,255,255,0.04); }
        .task-row__status { display: flex; align-items: center; flex-shrink: 0; }
        .task-row__name {
          flex: 1;
          font-size: 12.5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          opacity: 1;
        }
        .task-row__star { display: flex; align-items: center; flex-shrink: 0; }
        .task-row__chevron {
          font-size: 8px;
          opacity: 0.25;
          flex-shrink: 0;
          width: 10px;
          text-align: center;
        }
        .task-row__note {
          padding: 6px 12px 10px 36px;
          background: rgba(0,0,0,0.15);
          border-top: 1px solid rgba(255,255,255,0.04);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .task-row__meta-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .task-row__stage-select {
          flex: 1;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 4px;
          padding: 3px 7px;
          font-size: 11px;
          color: #c8c8d4;
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .task-row__stage-select:hover { border-color: rgba(255,255,255,0.25); }
        .task-row__stage-select option { background: #1a1a28; color: #e2e2e8; }
        .task-row__delete {
          font-size: 11px;
          padding: 3px 10px;
          border: 1px solid rgba(255,80,80,0.3);
          border-radius: 4px;
          color: rgba(255,120,120,0.7);
          white-space: nowrap;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .task-row__delete:hover {
          background: rgba(255,60,60,0.15);
          color: #ff8080;
          border-color: rgba(255,80,80,0.6);
        }
        .task-row__confirm {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .task-row__confirm-label {
          font-size: 11px;
          opacity: 0.55;
        }
        .task-row__confirm-yes {
          font-size: 11px;
          padding: 3px 8px;
          border: 1px solid rgba(255,80,80,0.5);
          border-radius: 4px;
          color: #ff8080;
          transition: background 0.12s;
        }
        .task-row__confirm-yes:hover { background: rgba(255,60,60,0.2); }
        .task-row__confirm-no {
          font-size: 11px;
          padding: 3px 8px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 4px;
          opacity: 0.55;
          transition: background 0.12s, opacity 0.12s;
        }
        .task-row__confirm-no:hover { opacity: 1; background: rgba(255,255,255,0.07); }
      `}</style>
    </div>
  )
}
