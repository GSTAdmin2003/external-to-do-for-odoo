# Odoo To-Do — Sticky Electron App

A frameless, always-on-top, translucent sticky-note app that syncs personal to-dos from Odoo 18 in real time.

## Features

- Frosted glass overlay (stays on top of other windows)
- 3-column table: Date | Task + Status + Priority | Note
- Click status circle to cycle: ○ Open → ◑ In Progress → ● Done
- Click star to toggle priority (★)
- Click note to edit inline, blur to save to Odoo
- Real-time sync via webhook (Odoo pushes changes instantly)
- Single user, API key authentication

## Setup

### 1. Install dependencies

```bash
nvm use 20   # or any Node.js 18+
npm install
```

### 2. Run in development

```bash
npm run dev
```

### 3. Build for production

```bash
npm run build
npm run package:linux   # produces .AppImage and .deb in dist/
```

## Odoo Configuration

### Get your API key

1. In Odoo → Settings → Users → your user
2. Tab: **API Keys** → New → give it a name → Copy the key

### Configure the app

1. Launch the app, click the ⚙ gear icon
2. Fill in:
   - **Odoo URL**: e.g. `https://erp.mycompany.com`
   - **Database Name**: e.g. `mycompany`
   - **Username**: e.g. `admin`
   - **API Key**: the key you copied
   - **Webhook Port**: 3001 (default)
3. Click **Save & Connect**

### Set up webhooks (real-time sync)

In Odoo with developer mode on (`Settings → Technical → Automated Actions`):

Create **3 rules** (one for each trigger):

| Field | Value |
|---|---|
| Model | `project.task` |
| Trigger | When a record is Created / Updated / Deleted |
| Action | Send Webhook Notification |
| URL | `http://YOUR_MACHINE_IP:3001/webhook` |
| Filter | `[["project_id","=",false]]` |

> If Odoo is on the same machine: use `http://127.0.0.1:3001/webhook`  
> If Odoo is on a different server: enable "Bind to all interfaces" in Settings and use your machine's LAN IP.

### Test the webhook manually

```bash
curl -X POST http://localhost:3001/webhook \
  -H 'Content-Type: application/json' \
  -d '{"ids":[1]}'
```

The task list should refresh within 1 second.

## Architecture

```
src/
  main/
    index.ts          # Electron entry point
    windowConfig.ts   # Frameless transparent window
    webhook.ts        # Express webhook receiver on port 3001
    ipcHandlers.ts    # IPC: settings, window controls
    store.ts          # electron-store: persists settings
  preload/
    index.ts          # contextBridge API for renderer
  renderer/src/
    App.tsx            # Root: switches between TaskTable and SettingsPanel
    components/        # TitleBar, TaskTable, TaskRow, StatusCircle, StarToggle, NoteCell, SettingsPanel
    store/useTaskStore.ts   # Zustand: tasks, stageMap, settings, UI
    hooks/useIpcBridge.ts   # Bootstraps settings, listens for webhook push
    hooks/useOdooSync.ts    # Optimistic writes: cycleStatus, togglePriority, saveNote
    lib/odooClient.ts       # JSON-2 API calls to Odoo 18
```

## Stage Mapping

The app automatically detects Odoo stage names using heuristics:
- Stage with `is_closed=true` → Done ●
- Stage with name containing "progress", "doing", "ongoing" → In Progress ◑
- Lowest-sequence stage → Open ○

Detected stages are shown in Settings under **Detected Stages**.
# external-to-do-for-odoo
