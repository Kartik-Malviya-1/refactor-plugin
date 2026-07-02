import { ChevronRight, RotateCcw, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { useUIStore } from '../../store/ui'
import { useAuditStore } from '../../store/audit'
import { MODULE_CATALOG } from '../../../engine/registry'

export function Header() {
  const { currentPage, activeModuleId, navigate } = useUIStore()
  const { result, isScanning, cancelScan } = useAuditStore()

  const module = MODULE_CATALOG.find((m) => m.id === activeModuleId)
  const moduleName = module?.name ?? 'Audit'
  const showAuditActions = currentPage === 'audit' && result

  return (
    <header className="h-11 shrink-0 bg-surface-1 border-b border-border flex items-center px-4 gap-3">
      <div className="flex items-center gap-1 text-sm text-ink-3 min-w-0">
        {currentPage === 'dashboard' ? (
          <span className="font-medium text-ink">Dashboard</span>
        ) : currentPage === 'scan' ? (
          <>
            <button onClick={() => navigate('dashboard')} className="hover:text-ink transition-colors truncate">
              Dashboard
            </button>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium text-ink">{moduleName} &#8212; Scan</span>
          </>
        ) : (
          <>
            <button onClick={() => navigate('dashboard')} className="hover:text-ink transition-colors">Dashboard</button>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium text-ink">{moduleName}</span>
            {result && (
              <>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                <span className="text-ink-3 truncate max-w-[120px]">{result.scopeLabel}</span>
              </>
            )}
          </>
        )}
      </div>
      <div className="flex-1" />
      {isScanning && (
        <Button variant="ghost" size="sm" onClick={cancelScan}>
          <X className="w-3.5 h-3.5" />Cancel
        </Button>
      )}
      {showAuditActions && !isScanning && (
        <Button variant="ghost" size="sm" onClick={() => navigate('scan')}>
          <RotateCcw className="w-3 h-3" />Re-scan
        </Button>
      )}
      {currentPage === 'dashboard' && !isScanning && (
        <Button variant="primary" size="sm" onClick={() => navigate('scan')}>Run Audit</Button>
      )}
    </header>
  )
}
