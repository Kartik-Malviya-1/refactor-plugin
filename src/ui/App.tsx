import { usePluginMessages } from './hooks/usePluginMessage'
import { AppShell } from './components/layout/AppShell'
import { OverviewPage } from './pages/OverviewPage'
import { ScanPage } from './pages/ScanPage'
import { AuditPage } from './pages/AuditPage'
import { SourcesPage } from './pages/SourcesPage'
import { PlanningPage } from './pages/PlanningPage'
import { MigrationPreviewPage } from './pages/MigrationPreviewPage'
import { useUIStore } from './store/ui'

export default function App() {
  usePluginMessages()
  const { currentPage } = useUIStore()

  return (
    <AppShell>
      {currentPage === 'overview'   && <OverviewPage />}
      {currentPage === 'scan'       && <ScanPage />}
      {currentPage === 'signatures' && <AuditPage />}
      {currentPage === 'sources'    && <SourcesPage />}
      {currentPage === 'planning'   && <PlanningPage />}
      {currentPage === 'preview'    && <MigrationPreviewPage />}
      {currentPage === 'settings'   && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-sm font-medium text-ink">Settings</p>
            <p className="text-xs text-ink-3 mt-1">Coming in a future release.</p>
          </div>
        </div>
      )}
    </AppShell>
  )
}
