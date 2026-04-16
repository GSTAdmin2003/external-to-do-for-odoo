import React, { useState, useRef, useEffect } from 'react'
import { format, parseISO, isToday } from 'date-fns'
import { useTaskStore } from '../store/useTaskStore'
import { createTask } from '../lib/odooClient'
import { runRefresh } from '../hooks/useIpcBridge'

function getCfg(s: ReturnType<typeof useTaskStore.getState>['settings']) {
  return { odooUrl: s.odooUrl, dbName: s.dbName, username: s.username, apiKey: s.apiKey }
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]
const DAY_HEADERS = ['Mo','Tu','We','Th','Fr','Sa','Su']

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function buildCalGrid(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay() // 0=Sun
  const offset = firstDay === 0 ? 6 : firstDay - 1  // Mon-based offset
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return cells
}

export default function CreateTaskPanel(): React.ReactElement {
  const { settings, closeCreate } = useTaskStore()
  const [name, setName] = useState('')
  const [deadline, setDeadline] = useState(todayStr)
  const [priority, setPriority] = useState<'0' | '1'>('0')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calendar dropdown
  const [calOpen, setCalOpen] = useState(false)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const calRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  useEffect(() => {
    if (!calOpen) return
    function onDown(e: MouseEvent): void {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setCalOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [calOpen])

  function openCal(): void {
    if (deadline) {
      try {
        const d = parseISO(deadline)
        setCalYear(d.getFullYear())
        setCalMonth(d.getMonth())
      } catch {}
    }
    setCalOpen(true)
  }

  function selectDay(key: string): void {
    setDeadline(key)
    setCalOpen(false)
  }

  function prevMonth(): void {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth(): void {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  const calCells = buildCalGrid(calYear, calMonth)
  const today = todayStr()
  const nowYear = new Date().getFullYear()
  const nowMonth = new Date().getMonth()
  const canGoPrev = calYear > nowYear || (calYear === nowYear && calMonth > nowMonth)

  const deadlineLabel = deadline
    ? format(parseISO(deadline), 'MMM d, yyyy')
    : 'Pick a date'

  async function handleSave(): Promise<void> {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createTask(getCfg(settings), {
        name: name.trim(),
        ...(deadline ? { date_deadline: deadline } : {}),
        priority,
        ...(notes.trim() ? { description: notes.trim() } : {})
      })
      closeCreate()
      runRefresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave() }
    if (e.key === 'Escape') closeCreate()
  }

  return (
    <div className="create-panel">
      <div className="create-panel__header">
        <span className="create-panel__title">New Task</span>
        <button className="create-panel__close" onClick={closeCreate} title="Close">✕</button>
      </div>

      <div className="create-panel__body">
        <div className="create-panel__field">
          <label>Task name</label>
          <div className="create-panel__name-row">
            <input
              ref={nameRef}
              type="text"
              placeholder="What needs to be done?"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className={`create-panel__star ${priority === '1' ? 'active' : ''}`}
              onClick={() => setPriority(priority === '1' ? '0' : '1')}
            >
              {priority === '1' ? '★' : '☆'}
            </button>
          </div>
        </div>

        <div className="create-panel__field">
          <label>Deadline</label>
          <div className="create-panel__cal-wrap" ref={calRef}>
            <button
              className={`create-panel__cal-trigger ${calOpen ? 'open' : ''}`}
              onClick={openCal}
            >
              <svg width="12" height="12" viewBox="0 0 13 13" fill="none" style={{opacity: 0.5, flexShrink: 0}}>
                <rect x="1" y="2.5" width="11" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="1" y1="5.5" x2="12" y2="5.5" stroke="currentColor" strokeWidth="1"/>
                <line x1="4" y1="1" x2="4" y2="4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="9" y1="1" x2="9" y2="4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span>{deadlineLabel}</span>
            </button>

            {calOpen && (
              <div className="create-panel__cal-dropdown">
                <div className="create-panel__cal-header">
                  {canGoPrev ? (
                    <button className="create-panel__cal-nav" onClick={prevMonth}>‹</button>
                  ) : (
                    <span style={{width: 22}} />
                  )}
                  <span>{MONTH_NAMES[calMonth]} {calYear}</span>
                  <button className="create-panel__cal-nav" onClick={nextMonth}>›</button>
                </div>
                <div className="create-panel__cal-grid">
                  {DAY_HEADERS.map((d) => (
                    <span key={d} className="create-panel__cal-dow">{d}</span>
                  ))}
                  {calCells.map((key, i) => key === null ? (
                    <span key={i} />
                  ) : (
                    <button
                      key={key}
                      className={[
                        'create-panel__cal-day',
                        key === deadline ? 'selected' : '',
                        key === today ? 'today' : '',
                        key < today ? 'past' : ''
                      ].filter(Boolean).join(' ')}
                      onClick={() => key >= today && selectDay(key)}
                      disabled={key < today}
                    >
                      {parseInt(key.split('-')[2])}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="create-panel__field">
          <label>Notes</label>
          <textarea
            placeholder="Optional notes…"
            value={notes}
            onChange={(e) => { setNotes(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
            onKeyDown={(e) => { if (e.key === 'Escape') closeCreate() }}
            rows={3}
          />
        </div>

        {error && <div className="create-panel__error">{error}</div>}
      </div>

      <div className="create-panel__footer">
        <button className="create-panel__cancel" onClick={closeCreate}>Cancel</button>
        <button
          className="create-panel__save"
          onClick={handleSave}
          disabled={saving || !name.trim()}
        >
          {saving ? 'Creating…' : 'Create'}
        </button>
      </div>

      <style>{`
        .create-panel {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
        }
        .create-panel__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
        }
        .create-panel__title {
          font-size: 12px;
          font-weight: 600;
          opacity: 0.8;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .create-panel__close {
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
        .create-panel__close:hover { opacity: 1; background: rgba(255,80,80,0.25); }
        .create-panel__body {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .create-panel__field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .create-panel__field--row {
          flex-direction: row;
          align-items: center;
          gap: 8px;
        }
        .create-panel__field label {
          font-size: 11px;
          opacity: 0.55;
        }
        .create-panel__name-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .create-panel__name-row input { flex: 1; }
        .create-panel__field input[type="text"] {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 5px;
          padding: 5px 8px;
          font-size: 12px;
          color: #e2e2e8;
          width: 100%;
          transition: border-color 0.15s;
        }
        .create-panel__field input[type="text"]:focus,
        .create-panel__field textarea:focus {
          border-color: rgba(110,168,254,0.5);
          background: rgba(255,255,255,0.08);
          outline: none;
        }
        .create-panel__field textarea {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 5px;
          padding: 5px 8px;
          font-size: 12px;
          color: #e2e2e8;
          width: 100%;
          resize: none;
          overflow: hidden;
          line-height: 1.5;
          transition: border-color 0.15s;
          font-family: inherit;
        }

        /* Calendar trigger */
        .create-panel__cal-wrap {
          position: relative;
        }
        .create-panel__cal-trigger {
          display: flex;
          align-items: center;
          gap: 7px;
          width: 100%;
          padding: 5px 8px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 5px;
          font-size: 12px;
          color: #e2e2e8;
          text-align: left;
          transition: border-color 0.15s, background 0.15s;
        }
        .create-panel__cal-trigger:hover,
        .create-panel__cal-trigger.open {
          border-color: rgba(110,168,254,0.45);
          background: rgba(255,255,255,0.08);
        }

        /* Calendar dropdown */
        .create-panel__cal-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          background: #1c1c2a;
          border: 1px solid rgba(255,255,255,0.11);
          border-radius: 8px;
          padding: 8px;
          z-index: 200;
          box-shadow: 0 10px 32px rgba(0,0,0,0.55);
        }
        .create-panel__cal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 2px 6px;
          font-size: 11px;
          font-weight: 600;
          opacity: 0.7;
        }
        .create-panel__cal-nav {
          font-size: 15px;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          opacity: 0.6;
          transition: opacity 0.12s, background 0.12s;
        }
        .create-panel__cal-nav:hover { opacity: 1; background: rgba(255,255,255,0.08); }
        .create-panel__cal-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
        }
        .create-panel__cal-dow {
          font-size: 9.5px;
          opacity: 0.3;
          text-align: center;
          padding: 2px 0 4px;
        }
        .create-panel__cal-day {
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          border-radius: 4px;
          opacity: 0.5;
          transition: opacity 0.1s, background 0.1s;
        }
        .create-panel__cal-day:hover { opacity: 1; background: rgba(255,255,255,0.08); }
        .create-panel__cal-day.today { color: #a8d1ff; opacity: 0.85; }
        .create-panel__cal-day.selected {
          opacity: 1;
          background: rgba(110,168,254,0.25);
          color: #a8d1ff;
        }
        .create-panel__cal-day.today.selected {
          background: rgba(110,168,254,0.3);
        }
        .create-panel__cal-day.past {
          opacity: 0.18;
          cursor: default;
        }
        .create-panel__cal-day.past:hover { background: none; }

        .create-panel__star {
          font-size: 20px;
          opacity: 0.4;
          transition: opacity 0.15s;
          padding: 0 2px;
        }
        .create-panel__star:hover { opacity: 0.8; }
        .create-panel__star.active { opacity: 1; color: #f5c518; }
        .create-panel__error {
          font-size: 10.5px;
          color: #ff7070;
          opacity: 0.85;
        }
        .create-panel__footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 8px 12px;
          border-top: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
        }
        .create-panel__cancel {
          font-size: 12px;
          padding: 5px 12px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 5px;
          opacity: 0.6;
          transition: opacity 0.15s;
        }
        .create-panel__cancel:hover { opacity: 1; }
        .create-panel__save {
          font-size: 12px;
          padding: 5px 14px;
          background: rgba(110,168,254,0.2);
          border: 1px solid rgba(110,168,254,0.4);
          border-radius: 5px;
          color: #a8d1ff;
          transition: background 0.15s;
        }
        .create-panel__save:hover:not(:disabled) { background: rgba(110,168,254,0.35); }
        .create-panel__save:disabled { opacity: 0.4; cursor: default; }
      `}</style>
    </div>
  )
}
