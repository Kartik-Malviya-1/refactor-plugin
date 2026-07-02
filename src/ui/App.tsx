import { usePluginMessages } from './hooks/usePluginMessage'
import { AppShell } from './components/layout/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { ScanPage } from './pages/ScanPage'
import { AuditPage } from './pages/AuditPage'
import { useUIStore } from './store/ui'

export default function App() {
  usePluginMessages()
  const { currentPage } = useUIStore()

  return (
    <AppShell>
      {currentPage === 'dashboard' && <DashboardPage />}
      {currentPage === 'scan' && <ScanPage />}
      {currentPage === 'audit' && <AuditPage />}
    </AppShell>
  )
}
