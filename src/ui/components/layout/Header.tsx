import { ChevronRight, RotateCcw, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { useUIStore } from '../../store/ui'
import { useAuditStore } from '../../store/audit'

export function Header() {
  const { currentPage, navigate } = useUIStore()
  const { result, isScanning, cancelScan } = useAuditStore()

  const showRescan =
    (currentPage === 'signatures' || currentPage === 'sources' ||
     currentPage === 'families'   || currentPage === 'overview') &&
    result && !isScanning

  return (
    <header className="h-11 shrink-0 bg-surface-1 border-b border-border flex items-center px-4 gap-3">
      <div className="flex items-center gap-1 text-sm text-ink-3 min-w-0">
        {currentPage === 'overview' && (
          <span className="font-medium text-ink">Overview</span>
        )}
        {currentPage === 'scan' && (
          <>
            <button onClick={() => navigate('overview')} className="hover:text-ink transition-colors">Overview</button>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium text-ink">Scan</span>
          </>
        )}
        {currentPage === 'signatures' && (
          <>
            <button onClick={() => navigate('overview')} className="hover:text-ink transition-colors">Overview</button>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium text-ink">Typography Signatures</span>
            {result && (
              <><ChevronRight className="w-3.5 h-3.5 shrink-0" />
              <span className="text-ink-3 truncate max-w-[120px]">{result.scopeLabel}</span></>
            )}
          </>
        )}
        {currentPage === 'sources' && (
          <>
            <button onClick={() => navigate('overview')} className="hover:text-ink transition-colors">Overview</button>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium text-ink">Sources</span>
          </>
        )}
        {currentPage === 'families' && (
          <>
            <button onClick={() => navigate('overview')} className="hover:text-ink transition-colors">Overview</button>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium text-ink">Candidate Families</span>
          </>
        )}
        {currentPage === 'settings' && (
          <span className="font-medium text-ink">Settings</span>
        )}
      </div>

      <div className="flex-1" />

      {isScanning && (
        <Button variant="ghost" size="sm" onClick={cancelScan}>
          <X className="w-3.5 h-3.5" />Cancel
        </Button>
      )}
      {showRescan && (
        <Button variant="ghost" size="sm" onClick={() => navigate('scan')}>
          <RotateCcw className="w-3 h-3" />Re-scan
        </Button>
      )}
      {currentPage === 'overview' && !result && !isScanning && (
        <Button variant="primary" size="sm" onClick={() => navigate('scan')}>Run Scan</Button>
      )}
    </header>
  )
}
