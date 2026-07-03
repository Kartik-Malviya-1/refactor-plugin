import { useMemo, useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useUIStore } from '../../store/ui'
import { useAuditStore } from '../../store/audit'
import { usePlanningDataStore } from '../../store/planningData'
import { countPotentialConsolidations } from '../../../query/partitioner'
import { buildConfig } from '../../../clustering/strategies'
import { sendToPlugin } from '../../hooks/useSendMessage'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'

function StatCard({ label, value, sub }: { label: string; value: string|number; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-ink-3 mb-0.5">{label}</p>
      <p className="text-lg font-semibold text-ink tabular-nums">{value}</p>
      {sub && <p className="text-2xs text-ink-3 mt-0.5">{sub}</p>}
    </div>
  )
}

function SummaryCard({
  title, onNavigate, children, layerCount, empty = false,
}: {
  title: string; onNavigate: () => void; children: React.ReactNode
  layerCount: number; empty?: boolean
}) {
  return (
    <button onClick={onNavigate} disabled={empty}
      className="flex-1 min-w-0 bg-surface-1 border border-border rounded-lg p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed group">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-ink-disabled uppercase tracking-wider">{title}</p>
        <ArrowRight className="w-3.5 h-3.5 text-ink-disabled group-hover:text-ink transition-colors shrink-0" />
      </div>
      <p className="text-2xl font-bold text-ink tabular-nums mb-0.5">{layerCount.toLocaleString()}</p>
      <p className="text-xs text-ink-3 mb-3">text layers</p>
      <div className="space-y-1.5">{children}</div>
    </button>
  )
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-2xs text-ink-3">{label}</span>
      <span className="text-xs font-medium text-ink tabular-nums">{value}</span>
    </div>
  )
}

const BALANCED = buildConfig('balanced')

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

  const { rawGroups, libraryGroups, localGroups, variableGroups } = useMemo(() => ({
    rawGroups:      groups.filter(g => g.source === 'Raw Values' || g.source === 'Unknown' || !g.source),
    libraryGroups:  groups.filter(g => g.source === 'Library Text Style'),
    localGroups:    groups.filter(g => g.source === 'Local Text Style'),
    variableGroups: groups.filter(g => g.source === 'Variable'),
  }), [groups])

  // v0.2.2: Partition-first consolidation analysis (no global clustering)
  const { opportunities, estimatedReduction } = useMemo(() =>
    rawGroups.length > 0
      ? countPotentialConsolidations(rawGroups, BALANCED)
      : { opportunities: 0, estimatedReduction: 0 },
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
          <span className="text-2xl font-bold text-ink-3">T</span>
        </div>
        <div>
          <p className="text-sm font-medium text-ink mb-1">No scan data</p>
          <p className="text-xs text-ink-3 leading-relaxed mb-4">Scan this document to discover typography signatures, sources, and consolidation opportunities.</p>
          <Button variant="primary" size="md" onClick={() => navigate('scan')}>Run Scan</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Scan meta */}
      <div className="shrink-0 px-5 py-3 border-b border-border-subtle bg-surface-1">
        <p className="text-xs text-ink-3">
          Scope: <span className="font-medium text-ink-2">{result.scopeLabel}</span>
          <span className="mx-2 text-border-strong">·</span>
          {result.totalItems.toLocaleString()} layers
          <span className="mx-2 text-border-strong">·</span>
          {result.groups.length.toLocaleString()} signatures
          <span className="mx-2 text-border-strong">·</span>
          {new Date(result.scannedAt).toLocaleTimeString()}
        </p>
      </div>

      <div className="flex-1 px-5 py-5 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Raw Values */}
          <SummaryCard title="Raw Values" layerCount={sum(rawGroups)}
            onNavigate={() => navigate('typography/raw')} empty={rawGroups.length === 0}>
            <Row label="Signatures" value={rawGroups.length.toLocaleString()} />
            {opportunities > 0 && (
              <Row label="Consolidation Opportunities" value={opportunities.toLocaleString()} />
            )}
            {estimatedReduction > 0 && (
              <Row label="Potential Reduction" value={`${rawGroups.length} → ${rawGroups.length - estimatedReduction}`} />
            )}
          </SummaryCard>

          {/* Library Styles */}
          <SummaryCard title="Library Styles" layerCount={sum(libraryGroups)}
            onNavigate={() => navigate('typography/library')} empty={libraryGroups.length === 0 && libraryStyles.length === 0}>
            <Row label="Signatures" value={libraryGroups.length.toLocaleString()} />
            {libraryStyles.length > 0 && <Row label="Available Styles" value={libraryStyles.length.toLocaleString()} />}
            {libraryNames.length > 0 && <Row label="Libraries" value={libraryNames.length} />}
          </SummaryCard>

          {/* Local Styles */}
          <SummaryCard title="Local Styles" layerCount={sum(localGroups)}
            onNavigate={() => navigate('typography/local')} empty={localGroups.length === 0 && localStyles.length === 0}>
            <Row label="Signatures" value={localGroups.length.toLocaleString()} />
            {localStyles.length > 0 && <Row label="Available Styles" value={localStyles.length.toLocaleString()} />}
          </SummaryCard>

          {/* Variables */}
          <SummaryCard title="Variables" layerCount={sum(variableGroups)}
            onNavigate={() => navigate('typography/variables')} empty={variableGroups.length === 0 && variables.length === 0}>
            <Row label="Signatures" value={variableGroups.length.toLocaleString()} />
            {variables.length > 0 && <Row label="Available Variables" value={variables.length.toLocaleString()} />}
          </SummaryCard>
        </div>

        {/* Global stats */}
        {opportunities > 0 && (
          <div className="bg-accent-subtle border border-accent/20 rounded-lg px-4 py-3">
            <p className="text-xs font-semibold text-accent mb-2">Potential Consolidation Opportunities</p>
            <div className="flex gap-6">
              <StatCard label="Raw Signatures" value={rawGroups.length.toLocaleString()} />
              <StatCard label="Opportunities" value={opportunities.toLocaleString()} />
              <StatCard label="Estimated Reduction" value={`−${estimatedReduction}`}
                sub={`${rawGroups.length} → ${rawGroups.length - estimatedReduction}`} />
            </div>
            <p className="text-2xs text-accent/70 mt-2">
              Use the Query Builder in Raw Values to explore and define a Working Set.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
