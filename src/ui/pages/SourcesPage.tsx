import { useMemo } from 'react'
import { Layers, Search } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { InfoButton } from '../components/ui/InfoButton'
import { DEFINITIONS } from '../lib/definitions'
import { useUIStore } from '../store/ui'
import { useAuditStore } from '../store/audit'

// ---------------------------------------------------------------------------
// Source type values — shared across the platform
// ---------------------------------------------------------------------------
export type SourceType =
  | 'Raw Values'
  | 'Local Text Style'
  | 'Library Text Style'
  | 'Variable'
  | 'Unknown'

// Colour mapping for source badges
const SOURCE_STYLE: Record<SourceType, string> = {
  'Raw Values':          'bg-surface-hover text-ink-2',
  'Local Text Style':    'bg-accent-subtle text-accent',
  'Library Text Style':  'bg-success-subtle text-success',
  'Variable':            'bg-warning-subtle text-warning',
  'Unknown':             'bg-surface-0 text-ink-disabled border border-border-subtle',
}

function SourceBadge({ source }: { source: SourceType }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
      SOURCE_STYLE[source]
    }`}>
      {source}
    </span>
  )
}

interface SourceGroup {
  source: SourceType
  signatureCount: number
  layerCount: number
}

export function SourcesPage() {
  const { navigate } = useUIStore()
  const { result } = useAuditStore()

  // ---------------------------------------------------------------------------
  // Source classification
  // ---------------------------------------------------------------------------
  // Currently all signatures are classified as Unknown because textStyleId
  // is not collected during the scan. Sprint 2 will add this field to enable
  // proper classification into Raw Values / Local / Library / Variable.
  //
  // Rule: Never infer. If source cannot be determined confidently: Unknown.
  // ---------------------------------------------------------------------------
  const sourceGroups = useMemo<SourceGroup[]>(() => {
    if (!result) return []

    // Group audit groups by their source classification.
    // In Sprint 1: all signatures are Unknown.
    const bySource = new Map<SourceType, { signatures: number; layers: number }>()

    for (const group of result.groups) {
      // TODO Sprint 2: derive source from group.descriptor.textStyleId
      const source: SourceType = 'Unknown'
      const existing = bySource.get(source) ?? { signatures: 0, layers: 0 }
      bySource.set(source, {
        signatures: existing.signatures + 1,
        layers: existing.layers + group.count,
      })
    }

    return Array.from(bySource.entries())
      .map(([source, data]) => ({
        source,
        signatureCount: data.signatures,
        layerCount: data.layers,
      }))
      .sort((a, b) => b.layerCount - a.layerCount)
  }, [result])

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          icon={Layers}
          title="No scan data"
          description="Run a scan first to see source classification."
          action={<Button variant="primary" size="sm" onClick={() => navigate('scan')}>Run Scan</Button>}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-surface-1 px-5 py-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-ink">Sources</p>
          <InfoButton definition={DEFINITIONS.source} side="bottom" />
        </div>
        <p className="text-xs text-ink-3 mt-0.5">
          The origin of each Typography Signature in the document.
        </p>
      </div>

      {/* Source breakdown table */}
      <div className="flex-1 overflow-y-auto">
        {/* Column headers */}
        <div className="grid px-5 py-2 bg-surface-0 border-b border-border text-2xs font-semibold text-ink-3 uppercase tracking-wider"
          style={{ gridTemplateColumns: '1fr 120px 120px' }}
        >
          <span>Source</span>
          <span className="text-right">Signatures</span>
          <span className="text-right">Layers</span>
        </div>

        {sourceGroups.map((sg) => (
          <div
            key={sg.source}
            className="grid items-center px-5 py-3 border-b border-border-subtle hover:bg-surface-hover transition-colors"
            style={{ gridTemplateColumns: '1fr 120px 120px' }}
          >
            <SourceBadge source={sg.source} />
            <span className="text-sm tabular-nums text-ink-2 text-right">
              {sg.signatureCount.toLocaleString()}
            </span>
            <span className="text-sm tabular-nums text-ink text-right font-medium">
              {sg.layerCount.toLocaleString()}
            </span>
          </div>
        ))}

        {/* Sprint 2 note */}
        <div className="px-5 py-4 bg-surface-0 border-t border-border-subtle mt-2">
          <p className="text-xs font-medium text-ink-2 mb-1">About Source Classification</p>
          <p className="text-xs text-ink-3 leading-relaxed">
            Accurate classification (Raw Values, Local Style, Library Style, Variable)
            requires enhanced scan data planned for Sprint 2. All signatures currently
            show as <span className="font-medium">Unknown</span> because the source cannot
            be determined with confidence from the current scan.
          </p>
          <p className="text-xs text-ink-disabled mt-2">
            Refactor never infers source. If it cannot be determined confidently,
            it is shown as Unknown.
          </p>
        </div>
      </div>
    </div>
  )
}
