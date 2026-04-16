import React, { useMemo, useState, useEffect, useRef } from 'react'
import { format, parseISO, isToday } from 'date-fns'
import { useTaskStore } from '../store/useTaskStore'
import TaskRow from './TaskRow'
import { useRefresh } from '../hooks/useIpcBridge'

function toDateKey(dateStr: string | false): string {
  if (!dateStr) return '—'
  try { return format(parseISO(dateStr.split(' ')[0]), 'yyyy-MM-dd') } catch { return '—' }
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export default function TaskTable(): React.ReactElement {
  const { tasks, isSyncing, error, lastSynced, settings, openSettings } = useTaskStore()
  const refresh = useRefresh()
  const hasConfig = Boolean(settings.odooUrl && settings.apiKey && settings.dbName)

  const dateBuckets = useMemo(() => {
    const map = new Map<string, typeof tasks>()
    for (const task of tasks) {
      const key = toDateKey(task.create_date)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(task)
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === '—') return 1
      if (b === '—') return -1
      return b.localeCompare(a)
    })
  }, [tasks])

  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const [selectedDate, setSelectedDate] = useState<string>(todayKey)
  const [showDone, setShowDone] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState<number>(new Date().getFullYear())
  const [pickerMonth, setPickerMonth] = useState<number>(new Date().getMonth())
  const pickerWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (dateBuckets.length === 0) return
    const keys = dateBuckets.map(([k]) => k)
    if (selectedDate !== 'all' && !keys.includes(selectedDate)) {
      if (keys.includes(todayKey)) setSelectedDate(todayKey)
      else setSelectedDate(keys[0])
    }
  }, [dateBuckets])

  useEffect(() => {
    if (!showPicker) return
    function onMouseDown(e: MouseEvent): void {
      if (pickerWrapRef.current && !pickerWrapRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [showPicker])

  const getFilteredCount = (key: string): number => {
    if (key === 'all') return tasks.filter((t) => showDone ? t.state === '1_done' : t.state !== '1_done').length
    const bucket = dateBuckets.find(([k]) => k === key)?.[1] ?? []
    return bucket.filter((t) => showDone ? t.state === '1_done' : t.state !== '1_done').length
  }

  // Keys with non-zero count for the filter (used by tabs and picker)
  const activeKeys = useMemo(() =>
    dateBuckets
      .filter(([, bucket]) => bucket.filter((t) =>
        showDone ? t.state === '1_done' : t.state !== '1_done'
      ).length > 0)
      .map(([k]) => k),
    [dateBuckets, showDone, tasks]
  )

  // Group active date keys by year → month → sorted day keys
  const groupedDates = useMemo(() => {
    const result = new Map<number, Map<number, string[]>>()
    for (const key of activeKeys) {
      if (key === '—') continue
      try {
        const d = parseISO(key)
        const y = d.getFullYear()
        const m = d.getMonth()
        if (!result.has(y)) result.set(y, new Map())
        const mmap = result.get(y)!
        if (!mmap.has(m)) mmap.set(m, [])
        mmap.get(m)!.push(key)
      } catch {}
    }
    return result
  }, [activeKeys])

  // Flat sorted list of {year, month} pairs that have tasks, newest first
  const availableMonths = useMemo(() => {
    const pairs: { year: number; month: number }[] = []
    for (const [y, mmap] of groupedDates.entries()) {
      for (const m of mmap.keys()) pairs.push({ year: y, month: m })
    }
    return pairs.sort((a, b) =>
      a.year !== b.year ? b.year - a.year : b.month - a.month
    )
  }, [groupedDates])

  // When picker opens, snap to the selected date's month (or most recent)
  useEffect(() => {
    if (!showPicker || availableMonths.length === 0) return
    if (selectedDate !== 'all') {
      try {
        const d = parseISO(selectedDate)
        setPickerYear(d.getFullYear())
        setPickerMonth(d.getMonth())
        return
      } catch {}
    }
    setPickerYear(availableMonths[0].year)
    setPickerMonth(availableMonths[0].month)
  }, [showPicker])

  const displayedTasks = useMemo(() => {
    const bucket = selectedDate === 'all'
      ? tasks
      : dateBuckets.find(([k]) => k === selectedDate)?.[1] ?? []
    return [...bucket]
      .filter((t) => showDone ? t.state === '1_done' : t.state !== '1_done')
      .sort((a, b) => {
        const pDiff = Number(b.priority === '1') - Number(a.priority === '1')
        if (pDiff !== 0) return pDiff
        return (b.create_date || '').localeCompare(a.create_date || '')
      })
  }, [dateBuckets, selectedDate, showDone, tasks])

  function tabLabel(key: string): string {
    if (key === '—') return '—'
    try {
      const d = parseISO(key)
      return isToday(d) ? 'Today' : format(d, 'dd.MM.yy')
    } catch { return key }
  }

  function selectDate(key: string): void {
    setSelectedDate(key)
    setShowPicker(false)
  }

  const pickerIdx = availableMonths.findIndex(
    (p) => p.year === pickerYear && p.month === pickerMonth
  )
  const currentMonthDays = groupedDates.get(pickerYear)?.get(pickerMonth) ?? []

  return (
    <div className="task-table">
      {dateBuckets.length > 0 && (
        <div className="task-table__dates-row">
          <div className="task-table__dates">
            {/* All tab */}
            <button
              className={`task-table__date-tab ${selectedDate === 'all' ? 'active' : ''}`}
              onClick={() => selectDate('all')}
            >
              All
              <span className="task-table__date-count">{getFilteredCount('all')}</span>
            </button>
            {/* Per-date tabs — overflow:hidden clips ones that don't fit */}
            {activeKeys.map((key) => (
              <button
                key={key}
                className={[
                  'task-table__date-tab',
                  selectedDate === key ? 'active' : '',
                  key !== '—' && isToday(parseISO(key)) ? 'today' : ''
                ].filter(Boolean).join(' ')}
                onClick={() => selectDate(key)}
              >
                {tabLabel(key)}
                <span className="task-table__date-count">{getFilteredCount(key)}</span>
              </button>
            ))}
          </div>

          <div className="task-table__row-controls">
            {/* Calendar picker */}
            <div className="task-table__picker-wrap" ref={pickerWrapRef}>
              <button
                className={`task-table__cal-btn ${showPicker ? 'open' : ''}`}
                onClick={() => setShowPicker((v) => !v)}
                title="Browse by date"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <rect x="1" y="2.5" width="11" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                  <line x1="1" y1="5.5" x2="12" y2="5.5" stroke="currentColor" strokeWidth="1"/>
                  <line x1="4" y1="1" x2="4" y2="4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  <line x1="9" y1="1" x2="9" y2="4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </button>

              {showPicker && (
                <div className="task-table__picker">
                  {/* Year nav */}
                  {(() => {
                    const availableYears = [...groupedDates.keys()].sort((a, b) => b - a)
                    const yearIdx = availableYears.indexOf(pickerYear)
                    return (
                      <div className="task-table__picker-year">
                        <button
                          className="task-table__picker-yr-arrow"
                          onClick={() => {
                            if (yearIdx < availableYears.length - 1) {
                              const y = availableYears[yearIdx + 1]
                              setPickerYear(y)
                              const months = [...(groupedDates.get(y)?.keys() ?? [])].sort((a, b) => b - a)
                              if (months.length > 0) setPickerMonth(months[0])
                            }
                          }}
                          disabled={yearIdx >= availableYears.length - 1}
                        >‹</button>
                        <span>
                          {pickerYear}
                          <span className="task-table__picker-badge">
                            {activeKeys.filter((k) => k.startsWith(String(pickerYear))).reduce((s, k) => s + getFilteredCount(k), 0)}
                          </span>
                        </span>
                        <button
                          className="task-table__picker-yr-arrow"
                          onClick={() => {
                            if (yearIdx > 0) {
                              const y = availableYears[yearIdx - 1]
                              setPickerYear(y)
                              const months = [...(groupedDates.get(y)?.keys() ?? [])].sort((a, b) => b - a)
                              if (months.length > 0) setPickerMonth(months[0])
                            }
                          }}
                          disabled={yearIdx <= 0}
                        >›</button>
                      </div>
                    )
                  })()}

                  {/* Sidebar + dates */}
                  <div className="task-table__picker-body">
                    {/* Month sidebar */}
                    <div className="task-table__picker-month-list">
                      {availableMonths
                        .filter((p) => p.year === pickerYear)
                        .map((p) => (
                          <button
                            key={p.month}
                            className={`task-table__picker-month-item ${p.month === pickerMonth ? 'active' : ''}`}
                            onClick={() => setPickerMonth(p.month)}
                          >
                            <span>{MONTH_NAMES[p.month]}</span>
                            <span className="task-table__picker-badge">
                              {(groupedDates.get(p.year)?.get(p.month) ?? []).reduce((s, k) => s + getFilteredCount(k), 0)}
                            </span>
                          </button>
                        ))
                      }
                    </div>

                    {/* Date chips */}
                    <div className="task-table__picker-days">
                      {[...currentMonthDays].sort((a, b) => b.localeCompare(a)).map((key) => {
                        const day = parseISO(key).getDate()
                        return (
                          <button
                            key={key}
                            className={[
                              'task-table__picker-day',
                              selectedDate === key ? 'active' : '',
                              isToday(parseISO(key)) ? 'today' : ''
                            ].filter(Boolean).join(' ')}
                            onClick={() => selectDate(key)}
                            title={key}
                          >
                            {day}
                            <span className="task-table__picker-badge">{getFilteredCount(key)}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Status toggle */}
            <button
              className={`task-table__status-toggle ${showDone ? 'done' : 'active'}`}
              onClick={() => setShowDone((v) => !v)}
              title={showDone ? 'Showing done — click for in progress' : 'Showing in progress — click for done'}
            >
              {showDone ? '●' : '◑'}
            </button>
          </div>
        </div>
      )}

      <div className="task-table__body">
        {!hasConfig && (
          <div className="task-table__empty">
            <p>Not connected to Odoo.</p>
            <button className="task-table__setup-btn" onClick={openSettings}>Configure →</button>
          </div>
        )}
        {hasConfig && !isSyncing && tasks.length === 0 && !error && (
          <div className="task-table__empty">
            <p>No personal to-dos found.</p>
            <button className="task-table__setup-btn" onClick={() => refresh()}>Refresh</button>
          </div>
        )}
        {displayedTasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </div>

      <div className="task-table__footer">
        {error ? (
          <span className="task-table__error" title={error}>
            ⚠ {error.slice(0, 60)}{error.length > 60 ? '…' : ''}
          </span>
        ) : (
          <span className="task-table__meta">
            {isSyncing
              ? 'Syncing…'
              : lastSynced
              ? `${displayedTasks.length} tasks · ${new Date(lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Not synced'}
          </span>
        )}
        <button
          className={`task-table__refresh-btn ${isSyncing ? 'spinning' : ''}`}
          onClick={() => refresh()}
          title="Refresh"
          disabled={isSyncing}
        >↻</button>
      </div>

      <style>{`
        .task-table {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
        }
        .task-table__dates-row {
          display: flex;
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
        }
        .task-table__dates {
          display: flex;
          gap: 4px;
          padding: 6px 4px 6px 10px;
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }
        .task-table__row-controls {
          display: flex;
          align-items: center;
          gap: 3px;
          padding-right: 6px;
          flex-shrink: 0;
        }
        .task-table__date-tab {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 5px;
          font-size: 11px;
          opacity: 0.45;
          border: 1px solid transparent;
          white-space: nowrap;
          transition: opacity 0.15s, background 0.15s, border-color 0.15s;
          flex-shrink: 0;
        }
        .task-table__date-tab:hover { opacity: 0.75; background: rgba(255,255,255,0.05); }
        .task-table__date-tab.active {
          opacity: 1;
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.12);
        }
        .task-table__date-tab.today { color: #a8d1ff; }
        .task-table__date-tab.today.active {
          background: rgba(110,168,254,0.15);
          border-color: rgba(110,168,254,0.3);
        }
        .task-table__date-count {
          font-size: 9px;
          opacity: 0.6;
          background: rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 0 4px;
          min-width: 14px;
          text-align: center;
        }

        /* Calendar picker */
        .task-table__picker-wrap {
          position: relative;
        }
        .task-table__cal-btn {
          width: 26px;
          height: 24px;
          border-radius: 5px;
          border: 1px solid transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.4;
          color: currentColor;
          transition: opacity 0.15s, background 0.15s, border-color 0.15s;
        }
        .task-table__cal-btn:hover { opacity: 0.8; background: rgba(255,255,255,0.07); }
        .task-table__cal-btn.open {
          opacity: 0.9;
          background: rgba(255,255,255,0.09);
          border-color: rgba(255,255,255,0.14);
        }
        .task-table__picker {
          position: absolute;
          top: calc(100% + 5px);
          right: 0;
          background: #1c1c2a;
          border: 1px solid rgba(255,255,255,0.11);
          border-radius: 9px;
          padding: 6px;
          z-index: 100;
          box-shadow: 0 10px 32px rgba(0,0,0,0.55);
          min-width: 200px;
        }
        .task-table__picker-all {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 5px 8px;
          border-radius: 5px;
          font-size: 11px;
          opacity: 0.55;
          transition: opacity 0.12s, background 0.12s;
        }
        .task-table__picker-all:hover { opacity: 0.9; background: rgba(255,255,255,0.06); }
        .task-table__picker-all.active { opacity: 1; background: rgba(255,255,255,0.08); }
        .task-table__picker-badge {
          font-size: 9px;
          background: rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 0 5px;
          min-width: 16px;
          text-align: center;
          opacity: 0.7;
        }
        .task-table__picker-year {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 3px 6px 5px;
          font-size: 11px;
          opacity: 0.5;
          font-weight: 600;
          letter-spacing: 0.05em;
        }
        .task-table__picker-year > span {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .task-table__picker-yr-arrow {
          font-size: 14px;
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          opacity: 0.7;
          transition: opacity 0.12s, background 0.12s;
        }
        .task-table__picker-yr-arrow:hover:not(:disabled) {
          opacity: 1;
          background: rgba(255,255,255,0.08);
        }
        .task-table__picker-yr-arrow:disabled { opacity: 0.2; cursor: default; }
        .task-table__picker-body {
          display: flex;
          align-items: flex-start;
          gap: 0;
        }
        .task-table__picker-month-list {
          display: flex;
          flex-direction: column;
          padding: 4px 0;
          min-width: 72px;
        }
        .task-table__picker-month-item {
          font-size: 10.5px;
          opacity: 0.4;
          height: 26px;
          padding: 0 6px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          transition: opacity 0.12s, background 0.12s;
          white-space: nowrap;
        }
        .task-table__picker-month-item:hover { opacity: 0.8; background: rgba(255,255,255,0.05); }
        .task-table__picker-month-item.active { opacity: 1; background: rgba(255,255,255,0.08); }
        .task-table__picker-days {
          display: flex;
          flex-direction: column;
          padding: 4px 4px 4px 6px;
          gap: 2px;
        }
        .task-table__picker-day {
          height: 26px;
          padding: 0 6px;
          font-size: 10.5px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          opacity: 0.45;
          border: none;
          border-radius: 4px;
          transition: opacity 0.12s, background 0.12s;
          white-space: nowrap;
        }
.task-table__picker-day:hover { opacity: 0.85; background: rgba(255,255,255,0.06); }
        .task-table__picker-day.active {
          opacity: 1;
          background: rgba(255,255,255,0.1);
        }
        .task-table__picker-day.today { color: #a8d1ff; }
        .task-table__picker-day.today.active {
          background: rgba(110,168,254,0.18);
          border-color: rgba(110,168,254,0.35);
        }

        /* Status toggle */
        .task-table__status-toggle {
          flex-shrink: 0;
          font-size: 13px;
          width: 26px;
          height: 24px;
          border-radius: 5px;
          border: 1px solid transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, border-color 0.15s, opacity 0.15s;
          opacity: 0.45;
        }
        .task-table__status-toggle:hover { opacity: 0.85; background: rgba(255,255,255,0.07); }
        .task-table__status-toggle.active {
          opacity: 0.9;
          color: #a8d1ff;
          background: rgba(110,168,254,0.12);
          border-color: rgba(110,168,254,0.25);
        }
        .task-table__status-toggle.done {
          opacity: 0.9;
          color: #80e0a0;
          background: rgba(80,200,120,0.12);
          border-color: rgba(80,200,120,0.25);
        }

        .task-table__body {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .task-table__empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          height: 120px;
          opacity: 0.4;
          font-size: 12px;
        }
        .task-table__setup-btn {
          font-size: 11px;
          padding: 4px 10px;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 5px;
          transition: background 0.15s;
        }
        .task-table__setup-btn:hover { background: rgba(255,255,255,0.1); }
        .task-table__footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 10px 4px 12px;
          border-top: 1px solid rgba(255,255,255,0.05);
          flex-shrink: 0;
          min-height: 26px;
        }
        .task-table__meta {
          font-size: 10px;
          opacity: 0.3;
          letter-spacing: 0.02em;
        }
        .task-table__error {
          font-size: 10px;
          color: #ff7070;
          opacity: 0.85;
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .task-table__refresh-btn {
          font-size: 14px;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.3;
          transition: opacity 0.15s, transform 0.15s;
          border-radius: 4px;
        }
        .task-table__refresh-btn:hover:not(:disabled) {
          opacity: 0.8;
          background: rgba(255,255,255,0.07);
        }
        .task-table__refresh-btn.spinning {
          animation: spin 1s linear infinite;
          opacity: 0.5;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
