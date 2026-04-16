import React from 'react'
import { useTaskStore } from './store/useTaskStore'
import { useIpcBridge } from './hooks/useIpcBridge'
import TitleBar from './components/TitleBar'
import TaskTable from './components/TaskTable'
import SettingsPanel from './components/SettingsPanel'
import CreateTaskPanel from './components/CreateTaskPanel'
import StagesPanel from './components/StagesPanel'

export default function App(): React.ReactElement {
  useIpcBridge()
  const isSettingsOpen = useTaskStore((s) => s.isSettingsOpen)
  const isCreateOpen = useTaskStore((s) => s.isCreateOpen)
  const isStagesOpen = useTaskStore((s) => s.isStagesOpen)

  return (
    <div className="app-shell">
      <TitleBar />
      {isSettingsOpen ? <SettingsPanel />
        : isCreateOpen ? <CreateTaskPanel />
        : isStagesOpen ? <StagesPanel />
        : <TaskTable />}
    </div>
  )
}
