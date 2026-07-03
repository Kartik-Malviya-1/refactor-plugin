import { RotateCcw, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { useUIStore } from '../../store/ui'
import { useAuditStore } from '../../store/audit'

const PAGE_TITLE: Record<string, string> = {
  'typography/overview':   'Typography',
  'typography/raw':        'Raw Values',
  'typography/library':    'Library Styles',
  'typography/local':      'Local Styles',
  'typography/variables':  'Variables',
  'typography/review':     'Review Changes',
  'typography/signatures': 'Typography Signatures',
  'scan':                  'Scan',
  'settings':              'Settings',
}

export function Header() {
  const { currentPage, navigate } = useUIStore()
  const { result, isScanning, cancelScan } = useAuditStore()

  const title         = PAGE_TITLE[currentPage] ?? 'Refactor'
  const isTypographySub = currentPage.startsWith('typography/') && currentPage !== 'typography/overview'
  const showRescan    = result && !isScanning && currentPage !== 'scan'

  return (
    <header className="h-11 shrink-0 bg-surface-1 border-b border-border flex items-center px-4 gap-3">
      <div className="flex items-center gap-1.5 text-sm min-w-0">
        {isTypographySub ? (
          <>
            <button
              onClick={() => navigate('typography/overview')}
              className="text-ink-3 hover:text-ink transition-colors"
            >
              Typography
            </button>
            <span className="text-ink-disabled">/</span>
            <span className="font-medium text-ink">{title}</span>
          </>
        ) : (
          <span className="font-medium text-ink">{title}</span>
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

      {!result && !isScanning && currentPage !== 'scan' && (
        <Button variant="primary" size="sm" onClick={() => navigate('scan')}>Run Scan</Button>
      )}
    </header>
  )
}
