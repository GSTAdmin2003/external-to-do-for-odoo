import React from 'react'
import { useTaskStore } from '../store/useTaskStore'

export default function TitleBar(): React.ReactElement {
  const { openSettings, openCreate, openStages, isPinned } = useTaskStore()

  const handleMinimize = (): void => window.electronAPI.minimize()
  const handleClose = (): void => window.electronAPI.close()
  const handlePin = (): void => window.electronAPI.toggleAlwaysOnTop()

  return (
    <div className="title-bar">
      <div className="title-bar__drag">
        <span className="title-bar__icon">☰</span>
        <span className="title-bar__label">Odoo To-Do</span>
      </div>
      <div className="title-bar__controls">
<button
          className="title-bar__btn title-bar__btn--create"
          onClick={openCreate}
          title="New task"
        >
          +
        </button>
        <button
          className="title-bar__btn title-bar__btn--stages"
          onClick={openStages}
          title="Manage stages"
        >
          ≡
        </button>
        <button
          className={`title-bar__btn title-bar__btn--pin ${isPinned ? 'active' : ''}`}
          onClick={handlePin}
          title={isPinned ? 'Unpin from top' : 'Pin on top'}
        >
          📌
        </button>
        <button
          className="title-bar__btn"
          onClick={openSettings}
          title="Settings"
        >
          ⚙
        </button>
        <button
          className="title-bar__btn title-bar__btn--min"
          onClick={handleMinimize}
          title="Minimize"
        >
          ─
        </button>
        <button
          className="title-bar__btn title-bar__btn--close"
          onClick={handleClose}
          title="Close"
        >
          ✕
        </button>
      </div>

      <style>{`
        .title-bar {
          -webkit-app-region: drag;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 34px;
          padding: 0 10px 0 12px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          flex-shrink: 0;
          border-radius: 10px 10px 0 0;
          user-select: none;
        }
        .title-bar__drag {
          display: flex;
          align-items: center;
          gap: 7px;
          flex: 1;
        }
        .title-bar__icon {
          font-size: 12px;
          opacity: 0.5;
        }
        .title-bar__label {
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.02em;
          opacity: 0.7;
        }
        .title-bar__controls {
          -webkit-app-region: no-drag;
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .title-bar__btn {
          -webkit-app-region: no-drag;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 5px;
          font-size: 11px;
          opacity: 0.45;
          transition: opacity 0.15s, background 0.15s;
        }
        .title-bar__btn:hover {
          opacity: 1;
          background: rgba(255, 255, 255, 0.1);
        }
        .title-bar__btn--pin.active {
          opacity: 0.9;
          color: #6ea8fe;
        }
        .title-bar__btn--create {
          font-size: 16px;
          font-weight: 300;
        }
        .title-bar__btn--create:hover {
          background: rgba(110,168,254,0.2);
          color: #a8d1ff;
          opacity: 1;
        }
        .title-bar__btn--stages {
          font-size: 14px;
        }
        .title-bar__btn--stages:hover {
          background: rgba(110,168,254,0.15);
          color: #a8d1ff;
          opacity: 1;
        }
        .title-bar__btn--close:hover {
          background: rgba(255, 80, 80, 0.3);
          opacity: 1;
        }
      `}</style>
    </div>
  )
}
