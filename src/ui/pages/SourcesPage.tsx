import { useMemo } from 'react'
import { Layers } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { InfoButton } from '../components/ui/InfoButton'
import { DEFINITIONS } from '../lib/definitions'
import { useUIStore } from '../store/ui'
import { useAuditStore } from '../store/audit'
import type { SourceType } from '../../shared/types'

// ---------------------------------------------------------------------------
// Source display configuration
// ---------------------------------------------------------------------------

const SOURCE_ORDER: SourceType[] = [
  'Raw Values',
  'Local Text Style',
  'Library Text Style',
  'Variable',
  'Unknown',
]

const SOURCE_BADGE: Record<SourceType, string> = {
  'Raw Values':          'bg-surface-active text-ink-2 border border-border',
  'Local Text Style':    'bg-accent-subtle text-accent border border-accent/20',
  'Library Text Style':  'bg-success-subtle text-success border border-success/20',
  'Variable':            'bg-warning-subtle text-warning border border-warning/20',
  'Unknown':             'bg-surface-0 text-ink-disabled border border-border-subtle',
}

const SOURCE_DESC: Record<SourceType, string> = {
  'Raw Values':          'Defined directly on the layer, not using a text style.',
  'Local Text Style':    'Uses a text style defined in this file.',
  'Library Text Style':  'Uses a text style from a shared library.',
  'Variable':            'Typography values bound to a variable.',
  'Unknown':             'Source could not be determined.',
}

function SourceBadge({ source }: { source: SourceType }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SOURCE_BADGE[source]}`}>
      {source}
    </span>
  )
}

interface SourceRow {
  source: SourceType
  signatures: number
  layers: number
}

// ---------------------------------------------------------------------------
// Health observation
// ---------------------------------------------------------------------------

interface Observation {
  level: 'info' | 'warning'
  message: string
}

function ObservationBadge({ obs }: { obs: Observation }) {
  const cls = obs.level === 'warning'
    ? 'bg-warning-subtle border-warning/20 text-warning'
    : 'bg-surface-0 border-border text-ink-3'
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded border text-xs leading-relaxed ${cls}`}>
      <span className="shrink-0 mt-0.5">{obs.level === 'warning' ? '⚠️' : 'ℹ️'}</span>
      <span>{obs.message}</span>
    </div>
  )
}

export function SourcesPage() {
  const { navigate } = useUIStore()
  const { result } = useAuditStore()

  const { rows, observations } = useMemo(() => {
    if (!result) return { rows: [], observations: [] }

    // Aggregate groups by source
    const bySource = new Map<SourceType, { signatures: number; layers: number }>()
    for (const group of result.groups) {
      const src: SourceType = (group.source as SourceType) ?? 'Unknown'
      const existing = bySource.get(src) ?? { signatures: 0, layers: 0 }
      bySource.set(src, { signatures: existing.signatures + 1, layers: existing.layers + group.count })
    }

    const rows: SourceRow[] = SOURCE_ORDER
      .filter((s) => bySource.has(s))
      .map((source) => {
        const d = bySource.get(source)!
        return { source, signatures: d.signatures, layers: d.layers }
      })

    // Health observations — passive, no recommendations
    const obs: Observation[] = []
    const rawRow = bySource.get('Raw Values')
    if (rawRow) {
      const rawPct = rawRow.layers / result.totalItems
      if (rawPct > 0.5) {
        obs.push({ level: 'warning', message: `${Math.round(rawPct * 100)}% of text layers use raw values rather than a named text style.` })
      } else if (rawPct > 0.2) {
        obs.push({ level: 'info', message: `${Math.round(rawPct * 100)}% of text layers use raw values.` })
      }
    }

    const activeSources = [...bySource.keys()].filter(s => s !== 'Unknown')
    if (activeSources.length > 1) {
      obs.push({ level: 'info', message: `Multiple typography sources detected: ${activeSources.join(', ')}.` })
    }

    if (result.groups.length > 200) {
      obs.push({ level: 'warning', message: `${result.groups.length.toLocaleString()} unique Typography Signatures detected. Consider standardising toward fewer signatures.` })
    }

    return { rows, observations: obs }
  }, [result])

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          icon={Layers}
          title="No scan data"
          description="Run a scan to see source classification."
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

      <div className="flex-1 overflow-y-auto">
        {/* Observations */}
        {observations.length > 0 && (
          <div className="px-4 py-3 border-b border-border-subtle space-y-2">
            <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Observations</p>
            {observations.map((obs, i) => <ObservationBadge key={i} obs={obs} />)}
          </div>
        )}

        {/* Column headers */}
        <div
          className="grid px-4 py-2 bg-surface-0 border-b border-border text-2xs font-semibold text-ink-3 uppercase tracking-wider"
          style={{ gridTemplateColumns: '1fr 100px 120px' }}
        >
          <span>Source</span>
          <span className="text-right">Signatures</span>
          <span className="text-right">Layers</span>
        </div>

        {rows.map((row) => (
          <div
            key={row.source}
            className="grid items-center px-4 py-3 border-b border-border-subtle"
            style={{ gridTemplateColumns: '1fr 100px 120px' }}
          >
            <div>
              <SourceBadge source={row.source} />
              <p className="text-xs text-ink-disabled mt-1 leading-relaxed">
                {SOURCE_DESC[row.source]}
              </p>
            </div>
            <span className="text-sm tabular-nums text-ink-2 text-right">{row.signatures.toLocaleString()}</span>
            <span className="text-sm tabular-nums text-ink font-medium text-right">{row.layers.toLocaleString()}</span>
          </div>
        ))}

        {/* Variable note */}
        {!rows.find(r => r.source === 'Variable') && (
          <div className="px-4 py-3 bg-surface-0">
            <p className="text-xs text-ink-disabled leading-relaxed">
              <span className="font-medium">Variable</span> classification requires
              <code className="mx-1 px-1 bg-surface-active rounded text-2xs">boundVariables</code>
              inspection, planned for Sprint 3.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
