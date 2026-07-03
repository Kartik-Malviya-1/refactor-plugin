import { useMemo, useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useUIStore } from '../../store/ui'
import { useAuditStore } from '../../store/audit'
import { usePlanningDataStore } from '../../store/planningData'
import { useTypographyClusters } from '../../hooks/useTypographyClusters'
import { buildTypographyClusters } from '../../../clustering/engine'
import { buildConfig } from '../../../clustering/strategies'
import { sendToPlugin } from '../../hooks/useSendMessage'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'
import type { SourceType } from '../../../shared/types'

function SummaryCard({
  title, onNavigate, children, layerCount, empty = false,
}: {
  title: string
  onNavigate: () => void
  children: React.ReactNode
  layerCount: number
  empty?: boolean
}) {
  return (
    <button
      onClick={onNavigate}
      disabled={empty}
      className="flex-1 min-w-0 bg-surface-1 border border-border rounded-lg p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed group"
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-ink-disabled uppercase tracking-wider">{title}</p>
        <ArrowRight className="w-3.5 h-3.5 text-ink-disabled group-hover:text-ink transition-colors shrink-0" />
      </div>
      <p className="text-2xl font-bold text-ink tabular-nums mb-0.5">{layerCount.toLocaleString()}</p>
      <p className="text-xs text-ink-3 mb-3">text layers</p>
      <div className="space-y-1">{children}</div>
    </button>
  )
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-2xs text-ink-3">{label}</span>
      <span className="text-xs font-medium text-ink tabular-nums">{value}</span>
    </div>
  )
}

export function TypographyOverview() {
  const { navigate } = useUIStore()
  const { result } = useAuditStore()
  const { textStyles, variables, loaded: planningLoaded } = usePlanningDataStore()

  useEffect(() => {
    if (!planningLoaded) sendToPlugin({ type: 'GET_PLANNING_DATA' })
  }, [planningLoaded])

  const groups = useMemo(() =>
    (result?.groups ?? []) as unknown as AuditGroup<TypographyProperties>[],
    [result]
  )

  // Partition groups by source
  const { rawGroups, libraryGroups, localGroups, variableGroups } = useMemo(() => ({
    rawGroups:      groups.filter(g => g.source === 'Raw Values' || g.source === 'Unknown' || !g.source),
    libraryGroups:  groups.filter(g => g.source === 'Library Text Style'),
    localGroups:    groups.filter(g => g.source === 'Local Text Style'),
    variableGroups: groups.filter(g => g.source === 'Variable'),
  }), [groups])

  // Compute raw value clusters for "Potential Consolidation"
  const rawClusters = useMemo(() =>
    rawGroups.length > 0 ? buildTypographyClusters(rawGroups, buildConfig('balanced')) : [],
    [rawGroups]
  )

  const sum = (gs: AuditGroup<TypographyProperties>[]) => gs.reduce((s, g) => s + g.count, 0)

  const libraryStyles = textStyles.filter(s => !s.isLocal)
  const localStyles   = textStyles.filter(s => s.isLocal)
  const libraryNames  = [...new Set(libraryStyles.map(s => s.libraryName).filter(Boolean))]

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-surface-hover flex items-center justify-center">
          <span className="text-2xl">T</span>
        </div>
        <div>
          <p className="text-sm font-medium text-ink mb-1">No scan data</p>
          <p className="text-xs text-ink-3 leading-relaxed mb-4">Scan this document to discover typography signatures, clusters and sources.</p>
          <Button variant="primary" size="md" onClick={() => navigate('scan')}>Run Scan</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Scan meta bar */}
      <div className="shrink-0 px-5 py-3 border-b border-border-subtle bg-surface-1">
        <p className="text-xs text-ink-3">
          Scope: <span className="font-medium text-ink-2">{result.scopeLabel}</span>
          <span className="mx-2 text-border-strong">·</span>
          {result.totalItems.toLocaleString()} text layers
          <span className="mx-2 text-border-strong">·</span>
          {result.groups.length.toLocaleString()} signatures
          <span className="mx-2 text-border-strong">·</span>
          Scanned {new Date(result.scannedAt).toLocaleTimeString()}
        </p>
      </div>

      {/* Summary cards */}
      <div className="flex-1 px-5 py-5">
        <div className="grid grid-cols-2 gap-3">
          {/* Raw Values */}
          <SummaryCard title="Raw Values" layerCount={sum(rawGroups)} onNavigate={() => navigate('typography/raw')} empty={rawGroups.length === 0}>
            <StatRow label="Signatures" value={rawGroups.length.toLocaleString()} />
            {rawClusters.length > 0 && (
              <>
                <StatRow label="Suggested Clusters" value={rawClusters.length.toLocaleString()} />
                <StatRow
                  label="Potential Consolidation"
                  value={`${rawGroups.length} → ${rawClusters.length}`}
                />
              </>
            )}
          </SummaryCard>

          {/* Library Styles */}
          <SummaryCard title="Library Styles" layerCount={sum(libraryGroups)} onNavigate={() => navigate('typography/library')} empty={libraryGroups.length === 0 && libraryStyles.length === 0}>
            <StatRow label="Signatures" value={libraryGroups.length.toLocaleString()} />
            {libraryStyles.length > 0 && (
              <StatRow label="Available Styles" value={libraryStyles.length.toLocaleString()} />
            )}
            {libraryNames.length > 0 && (
              <StatRow label="Libraries" value={libraryNames.length} />
            )}
          </SummaryCard>

          {/* Local Styles */}
          <SummaryCard title="Local Styles" layerCount={sum(localGroups)} onNavigate={() => navigate('typography/local')} empty={localGroups.length === 0 && localStyles.length === 0}>
            <StatRow label="Signatures" value={localGroups.length.toLocaleString()} />
            {localStyles.length > 0 && (
              <StatRow label="Available Styles" value={localStyles.length.toLocaleString()} />
            )}
          </SummaryCard>

          {/* Variables */}
          <SummaryCard title="Variables" layerCount={sum(variableGroups)} onNavigate={() => navigate('typography/variables')} empty={variableGroups.length === 0 && variables.length === 0}>
            <StatRow label="Signatures" value={variableGroups.length.toLocaleString()} />
            {variables.length > 0 && (
              <StatRow label="Available Variables" value={variables.length.toLocaleString()} />
            )}
          </SummaryCard>
        </div>
      </div>
    </div>
  )
}
