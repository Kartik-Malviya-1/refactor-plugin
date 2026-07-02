import { useState, useEffect } from 'react'
import { Layers, FileText, FolderOpen, ChevronRight } from 'lucide-react'
import type { ScanScope } from '../../shared/types'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { useUIStore } from '../store/ui'
import { useAuditStore } from '../store/audit'
import { sendToPlugin } from '../hooks/useSendMessage'
import { cn } from '../lib/cn'

const SCOPE_OPTIONS: { id: ScanScope; label: string; description: string; icon: React.ElementType; warning?: string }[] = [
  { id: 'selection', label: 'Current Selection', description: 'Scan only the currently selected layers and their children.', icon: Layers },
  { id: 'page', label: 'Current Page', description: 'Scan all text layers on the active Figma page.', icon: FileText },
  { id: 'file', label: 'Entire File', description: 'Scan across every page. May take longer for large files.', icon: FolderOpen, warning: 'Large files may take a while. Each page must be loaded.' },
]

export function ScanPage() {
  const [scope, setScope] = useState<ScanScope>('page')
  const { selectionCount, navigate } = useUIStore()
  const { isScanning, scanProgress, startScan, cancelScan } = useAuditStore()

  useEffect(() => {
    sendToPlugin({ type: 'GET_SELECTION_INFO' })
  }, [])

  if (isScanning) {
    const pct = scanProgress && scanProgress.total > 0 ? Math.round((scanProgress.current / scanProgress.total) * 100) : null
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <Spinner size="lg" />
        <div className="text-center">
          <p className="text-sm font-medium text-ink mb-1">Scanning…</p>
          <p className="text-xs text-ink-3">{scanProgress?.label ?? 'Collecting text layers'}</p>
        </div>
        {pct !== null && (
          <div className="w-48">
            <div className="h-1 bg-surface-hover rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all duration-180" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-2xs text-ink-3">{scanProgress?.current.toLocaleString()} layers</span>
              <span className="text-2xs text-ink-3">{pct}%</span>
            </div>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={cancelScan} className="mt-2">Cancel</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex-1 p-5">
        <div className="mb-4">
          <p className="text-sm font-semibold text-ink mb-0.5">Choose scan scope</p>
          <p className="text-xs text-ink-3">Narrower scopes are faster. Start with a page for most workflows.</p>
        </div>
        <div className="flex flex-col gap-2">
          {SCOPE_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const isDisabled = opt.id === 'selection' && selectionCount === 0
            const isSelected = scope === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => !isDisabled && setScope(opt.id)}
                disabled={isDisabled}
                className={cn(
                  'w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-colors duration-120',
                  isSelected ? 'border-accent bg-accent-subtle' : 'border-border bg-surface-1 hover:border-border-strong hover:bg-surface-hover',
                  isDisabled && 'opacity-40 cursor-not-allowed'
                )}
              >
                <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5', isSelected ? 'border-accent' : 'border-border-strong')}>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                </div>
                <Icon className={cn('w-4 h-4 shrink-0 mt-0.5', isSelected ? 'text-accent' : 'text-ink-3')} strokeWidth={1.75} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn('text-sm font-medium', isSelected ? 'text-accent' : 'text-ink')}>{opt.label}</p>
                    {opt.id === 'selection' && selectionCount > 0 && <span className="text-2xs text-ink-3">({selectionCount} layer{selectionCount !== 1 ? 's' : ''})</span>}
                    {opt.id === 'selection' && selectionCount === 0 && <span className="text-2xs text-ink-disabled">No selection</span>}
                  </div>
                  <p className="text-xs text-ink-3 mt-0.5 leading-relaxed">{opt.description}</p>
                  {opt.warning && isSelected && <p className="text-2xs text-warning mt-1">{opt.warning}</p>}
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <div className="shrink-0 border-t border-border-subtle px-5 py-3 bg-surface-1 flex items-center justify-between gap-3">
        <Button variant="ghost" size="md" onClick={() => navigate('dashboard')}>Cancel</Button>
        <Button variant="primary" size="md" onClick={() => startScan('typography', scope)}>
          Start Scan<ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
