import { usePluginMessages } from './hooks/usePluginMessage'
import { AppShell } from './components/layout/AppShell'

// Typography module pages
import { TypographyOverview } from './pages/typography/TypographyOverview'
import { RawValuesPage } from './pages/typography/RawValuesPage'
import { LibraryStylesPage } from './pages/typography/LibraryStylesPage'
import { LocalStylesPage } from './pages/typography/LocalStylesPage'
import { TypographyVariablesPage } from './pages/typography/TypographyVariablesPage'

// Preserved pages
import { AuditPage } from './pages/AuditPage'
import { ScanPage } from './pages/ScanPage'

import { useUIStore } from './store/ui'

export default function App() {
  usePluginMessages()
  const { currentPage } = useUIStore()

  return (
    <AppShell>
      {/* Scan */}
      {currentPage === 'scan' && <ScanPage />}

      {/* Typography module */}
      {currentPage === 'typography/overview'   && <TypographyOverview />}
      {currentPage === 'typography/raw'        && <RawValuesPage />}
      {currentPage === 'typography/library'    && <LibraryStylesPage />}
      {currentPage === 'typography/local'      && <LocalStylesPage />}
      {currentPage === 'typography/variables'  && <TypographyVariablesPage />}

      {/* Typography Signatures inspector (preserved for navigation from inspector buttons) */}
      {currentPage === 'typography/signatures' && <AuditPage />}

      {/* Settings */}
      {currentPage === 'settings' && (
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
