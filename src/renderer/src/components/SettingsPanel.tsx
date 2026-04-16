import React, { useState } from 'react'
import { useTaskStore } from '../store/useTaskStore'
import { useSaveSettings } from '../hooks/useIpcBridge'
import type { AppSettings } from '../store/useTaskStore'

export default function SettingsPanel(): React.ReactElement {
  const { settings, closeSettings, stages, stageMap } = useTaskStore()
  const [form, setForm] = useState<AppSettings>({ ...settings })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const saveSettings = useSaveSettings()

  function update(field: keyof AppSettings, value: string | number | boolean): void {
    setForm((f) => ({ ...f, [field]: value }))
    setSaved(false)
  }

  async function handleSave(): Promise<void> {
    setSaving(true)
    try {
      await saveSettings(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      closeSettings()
    } finally {
      setSaving(false)
    }
  }

  // Detect stage names for display
  const stageLabels = stageMap && stages.length > 0 ? {
    open: stages.find(s => s.id === stageMap.open)?.name ?? '—',
    inProgress: stages.find(s => s.id === stageMap.inProgress)?.name ?? '—',
    done: stages.find(s => s.id === stageMap.done)?.name ?? '—'
  } : null

  return (
    <div className="settings">
      <div className="settings__header">
        <span className="settings__title">Settings</span>
        <button className="settings__close" onClick={closeSettings} title="Close">✕</button>
      </div>

      <div className="settings__body">
        <div className="settings__section">
          <div className="settings__section-label">Odoo Connection</div>

          <div className="settings__field">
            <label>Odoo URL</label>
            <input
              type="url"
              placeholder="https://erp.mycompany.com"
              value={form.odooUrl}
              onChange={(e) => update('odooUrl', e.target.value)}
            />
          </div>

          <div className="settings__field">
            <label>Database Name</label>
            <input
              type="text"
              placeholder="mycompany"
              value={form.dbName}
              onChange={(e) => update('dbName', e.target.value)}
            />
          </div>

          <div className="settings__field">
            <label>Username</label>
            <input
              type="text"
              placeholder="admin"
              value={form.username}
              onChange={(e) => update('username', e.target.value)}
            />
          </div>

          <div className="settings__field">
            <label>Password</label>
            <div className="settings__input-row">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="Your Odoo login password"
                value={form.apiKey}
                onChange={(e) => update('apiKey', e.target.value)}
              />
              <button
                className="settings__eye"
                onClick={() => setShowKey(!showKey)}
                title={showKey ? 'Hide' : 'Show'}
              >
                {showKey ? '🙈' : '👁'}
              </button>
            </div>
            <span className="settings__hint">
              Your regular Odoo login password (or an API key if you have one)
            </span>
          </div>
        </div>

        <div className="settings__section">
          <div className="settings__section-label">Auto Sync</div>
          <div className="settings__field">
            <label>Poll interval (seconds)</label>
            <input
              type="number"
              min={0}
              max={3600}
              value={form.pollInterval}
              onChange={(e) => update('pollInterval', parseInt(e.target.value, 10) || 0)}
            />
            <span className="settings__hint">How often to auto-refresh from Odoo. 0 = disabled. Min 5s.</span>
          </div>
        </div>

        <div className="settings__section">
          <div className="settings__section-label">Webhook Server</div>

          <div className="settings__field">
            <label>Port</label>
            <input
              type="number"
              min={1024}
              max={65535}
              value={form.webhookPort}
              onChange={(e) => update('webhookPort', parseInt(e.target.value, 10))}
            />
          </div>

          <div className="settings__field settings__field--row">
            <label>Bind to all interfaces</label>
            <input
              type="checkbox"
              checked={form.webhookBindAll}
              onChange={(e) => update('webhookBindAll', e.target.checked)}
            />
            <span className="settings__hint">Enable if Odoo is on a different machine</span>
          </div>

          <div className="settings__hint-block">
            In Odoo: Settings → Technical → Automated Actions<br />
            Model: <code>project.task</code> · Action: Webhook<br />
            URL: <code>http://YOUR_IP:{form.webhookPort}/webhook</code><br />
            Filter: <code>[["project_id","=",false]]</code>
          </div>
        </div>

        {stageLabels && (
          <div className="settings__section">
            <div className="settings__section-label">Detected Stages</div>
            <div className="settings__stage-map">
              <span>○ Open → <em>{stageLabels.open}</em></span>
              <span>◑ In Progress → <em>{stageLabels.inProgress}</em></span>
              <span>● Done → <em>{stageLabels.done}</em></span>
            </div>
          </div>
        )}
      </div>

      <div className="settings__footer">
        <button className="settings__cancel" onClick={closeSettings}>Cancel</button>
        <button
          className={`settings__save ${saved ? 'saved' : ''}`}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save & Connect'}
        </button>
      </div>

      <style>{`
        .settings {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
        }
        .settings__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
        }
        .settings__title {
          font-size: 12px;
          font-weight: 600;
          opacity: 0.8;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .settings__close {
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
        .settings__close:hover {
          opacity: 1;
          background: rgba(255,80,80,0.25);
        }
        .settings__body {
          flex: 1;
          overflow-y: auto;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .settings__section {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .settings__section-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          opacity: 0.35;
          margin-bottom: 2px;
        }
        .settings__field {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .settings__field--row {
          flex-direction: row;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
        }
        .settings__field label {
          font-size: 11px;
          opacity: 0.6;
        }
        .settings__field input[type="text"],
        .settings__field input[type="url"],
        .settings__field input[type="password"],
        .settings__field input[type="number"] {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 5px;
          padding: 5px 8px;
          font-size: 12px;
          color: #e2e2e8;
          width: 100%;
          transition: border-color 0.15s;
        }
        .settings__field input:focus {
          border-color: rgba(110,168,254,0.5);
          background: rgba(255,255,255,0.08);
        }
        .settings__input-row {
          display: flex;
          gap: 4px;
        }
        .settings__input-row input {
          flex: 1;
        }
        .settings__eye {
          font-size: 12px;
          padding: 0 6px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 5px;
          opacity: 0.6;
          transition: opacity 0.15s;
          flex-shrink: 0;
        }
        .settings__eye:hover { opacity: 1; }
        .settings__hint {
          font-size: 10px;
          opacity: 0.35;
          line-height: 1.3;
        }
        .settings__hint-block {
          font-size: 10.5px;
          opacity: 0.4;
          line-height: 1.7;
          background: rgba(255,255,255,0.03);
          border-radius: 5px;
          padding: 7px 9px;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .settings__hint-block code {
          font-family: 'Fira Code', 'Consolas', monospace;
          background: rgba(255,255,255,0.07);
          padding: 1px 3px;
          border-radius: 3px;
          font-size: 10px;
        }
        .settings__stage-map {
          display: flex;
          flex-direction: column;
          gap: 3px;
          font-size: 11px;
          opacity: 0.55;
        }
        .settings__stage-map em {
          font-style: normal;
          opacity: 0.85;
          color: #a0c4ff;
        }
        .settings__footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 8px 12px;
          border-top: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
        }
        .settings__cancel {
          font-size: 12px;
          padding: 5px 12px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 5px;
          opacity: 0.6;
          transition: opacity 0.15s;
        }
        .settings__cancel:hover { opacity: 1; }
        .settings__save {
          font-size: 12px;
          padding: 5px 14px;
          background: rgba(110,168,254,0.2);
          border: 1px solid rgba(110,168,254,0.4);
          border-radius: 5px;
          color: #a8d1ff;
          transition: background 0.15s;
        }
        .settings__save:hover:not(:disabled) {
          background: rgba(110,168,254,0.35);
        }
        .settings__save.saved {
          background: rgba(80,200,120,0.2);
          border-color: rgba(80,200,120,0.4);
          color: #80e0a0;
        }
        .settings__save:disabled { opacity: 0.5; cursor: default; }
      `}</style>
    </div>
  )
}
