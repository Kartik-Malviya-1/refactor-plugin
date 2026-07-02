import { useMemo, useState } from 'react'
import { Download, GitMerge, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { useUIStore } from '../store/ui'
import { useAuditStore } from '../store/audit'
import { useCandidateFamilies } from '../hooks/useCandidateFamilies'
import { useMigrationStore } from '../store/migration'
import { usePlanningDataStore } from '../store/planningData'
import { buildPreviewItems } from '../../preview/analysis'
import { detectConflicts, runValidation } from '../../preview/conflicts'
import { runSimulation } from '../../simulation/engine'
import { exportSimulationToJSON, exportSimulationToMarkdown } from '../../simulation/export'
import type { SimulationResult, StepStatus, ReadinessLabel } from '../../simulation/types'
import { STAGE_LABEL } from '../../simulation/types'
import { cn } from '../lib/cn'

// ---------------------------------------------------------------------------
// Readiness display config
// ---------------------------------------------------------------------------

const READINESS_STYLE: Record<ReadinessLabel, string> = {
  'Not Ready':       'bg-danger-subtle text-danger border-danger/20',
  'Needs Review':    'bg-warning-subtle text-warning border-warning/20',
  'Ready':           'bg-accent-subtle text-accent border-accent/20',
  'Execution Ready': 'bg-success-subtle text-success border-success/20',
}

const STATUS_ICON: Record<StepStatus, { icon: typeof CheckCircle; className: string }> = {
  succeeded: { icon: CheckCircle,   className: 'text-success' },
  warning:   { icon: AlertTriangle, className: 'text-warning' },
  failed:    { icon: XCircle,       className: 'text-danger'  },
  blocked:   { icon: XCircle,       className: 'text-danger'  },
  skipped:   { icon: Clock,         className: 'text-ink-3'   },
}

// ---------------------------------------------------------------------------
// Hook: compute simulation
// ---------------------------------------------------------------------------

function useSimulation(): SimulationResult | null {
  const families          = useCandidateFamilies()
  const { plan }          = useMigrationStore()
  const { textStyles, variables } = usePlanningDataStore()

  return useMemo(() => {
    if (families.length === 0) return null
    const conflicts  = detectConflicts(families, plan.entries)
    const items      = buildPreviewItems(families, plan.entries, textStyles, variables, conflicts)
    if (items.length === 0) return null
    const validation = runValidation(families, plan.entries, textStyles, variables)
    return runSimulation(families, plan.entries, textStyles, variables, items, validation, conflicts)
  }, [families, plan, textStyles, variables])
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function SimulationPage() {
  const { navigate }    = useUIStore()
  const { result }      = useAuditStore()
  const simulation      = useSimulation()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState icon={GitMerge} title="No scan data"
          description="Complete Discovery → Planning → Preview before running Simulation."
          action={<Button variant="primary" size="sm" onClick={() => navigate('scan')}>Run Scan</Button>}
        />
      </div>
    )
  }

  if (!simulation) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState icon={GitMerge} title="No planned changes"
          description="Plan Typography Families in Design System Planning first."
          action={<Button variant="primary" size="sm" onClick={() => navigate('planning')}>Open Planning</Button>}
        />
      </div>
    )
  }

  const sim = simulation
  const estSec = (sim.estimatedExecutionTimeMs / 1000).toFixed(1)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-surface-1 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Migration Simulation</p>
              <p className="text-xs text-ink-3 mt-0.5">
                {sim.totalFamiliesPlanned} families · {sim.totalLayersAffected.toLocaleString()} layers
              </p>
            </div>
            <span className={cn('inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-semibold', READINESS_STYLE[sim.readinessLabel])}>
              {sim.readinessScore}% {sim.readinessLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => exportSimulationToJSON(sim)}>
              <Download className="w-3.5 h-3.5" />JSON
            </Button>
            <Button variant="secondary" size="sm" onClick={() => exportSimulationToMarkdown(sim)}>
              <Download className="w-3.5 h-3.5" />Markdown
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Readiness Summary */}
        <section className="px-5 py-4 border-b border-border-subtle">
          <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Migration Readiness</p>
          <div className="h-2 bg-surface-hover rounded-full overflow-hidden mb-3">
            <div
              className={cn('h-full rounded-full transition-all', sim.readinessScore >= 81 ? 'bg-success' : sim.readinessScore >= 61 ? 'bg-accent' : sim.readinessScore >= 41 ? 'bg-warning' : 'bg-danger')}
              style={{ width: `${sim.readinessScore}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {sim.readinessFactors.map(f => (
              <div key={f.name} className={cn('flex items-start gap-2 px-2.5 py-2 rounded border text-xs', f.passed ? 'bg-success-subtle border-success/20 text-success' : 'bg-warning-subtle border-warning/20 text-warning')}>
                {f.passed ? <CheckCircle className="w-3 h-3 shrink-0 mt-0.5" /> : <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />}
                <div className="min-w-0">
                  <p className="font-medium text-xs">{f.name} <span className="font-normal opacity-70">({f.weight}%)</span></p>
                  <p className="text-2xs opacity-80 truncate">{f.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Execution Pipeline */}
        <section className="px-5 py-4 border-b border-border-subtle">
          <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-3">Execution Pipeline</p>
          <div className="space-y-2">
            {sim.stageSummaries.map((stage, i) => (
              <div key={stage.stage}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xs text-ink-disabled w-4">{i + 1}</span>
                  <span className="text-xs font-medium text-ink flex-1">{STAGE_LABEL[stage.stage]}</span>
                  <div className="flex items-center gap-2 text-2xs">
                    {stage.succeeded > 0 && <span className="text-success">{stage.succeeded} ok</span>}
                    {stage.warnings  > 0 && <span className="text-warning">{stage.warnings} warn</span>}
                    {stage.failed    > 0 && <span className="text-danger">{stage.failed} fail</span>}
                    {stage.blocked   > 0 && <span className="text-danger">{stage.blocked} blocked</span>}
                  </div>
                </div>
                <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden ml-6">
                  {stage.succeeded > 0 && <div className="bg-success rounded-full" style={{ flex: stage.succeeded }} />}
                  {stage.warnings  > 0 && <div className="bg-warning rounded-full" style={{ flex: stage.warnings }} />}
                  {stage.failed    > 0 && <div className="bg-danger rounded-full"  style={{ flex: stage.failed }} />}
                  {stage.blocked   > 0 && <div className="bg-danger/40 rounded-full" style={{ flex: stage.blocked }} />}
                  {(stage.total - stage.succeeded - stage.warnings - stage.failed - stage.blocked) > 0 && (
                    <div className="bg-border rounded-full" style={{ flex: stage.total - stage.succeeded - stage.warnings - stage.failed - stage.blocked }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Dry Run Results */}
        <section className="px-5 py-4 border-b border-border-subtle">
          <div className="flex items-center justify-between mb-3">
            <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest">Dry Run Results</p>
            <div className="flex items-center gap-3 text-2xs">
              <span className="text-success">{sim.dryRunSucceeded} succeeded</span>
              <span className="text-warning">{sim.dryRunWarnings} warnings</span>
              {sim.dryRunFailed   > 0 && <span className="text-danger">{sim.dryRunFailed} failed</span>}
              {sim.dryRunBlocked  > 0 && <span className="text-danger">{sim.dryRunBlocked} blocked</span>}
            </div>
          </div>
          <div className="space-y-0.5">
            {sim.dryRunSteps.map(step => {
              const { icon: Icon, className } = STATUS_ICON[step.status]
              const isExpanded = expandedId === step.familyId
              return (
                <div key={step.familyId} className="rounded border border-border-subtle overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : step.familyId)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-hover transition-colors text-left"
                  >
                    <Icon className={cn('w-3.5 h-3.5 shrink-0', className)} />
                    <span className="text-xs font-medium text-ink flex-1 truncate">{step.familyLabel}</span>
                    <span className="text-2xs text-ink-3 tabular-nums shrink-0">{step.layerCount.toLocaleString()} layers</span>
                    <span className={cn('text-2xs px-1.5 py-0.5 rounded shrink-0',
                      step.status === 'succeeded' ? 'bg-success-subtle text-success'
                      : step.status === 'warning' ? 'bg-warning-subtle text-warning'
                      : 'bg-danger-subtle text-danger'
                    )}>{step.status}</span>
                  </button>
                  {isExpanded && (
                    <div className="px-3 py-2 bg-surface-0 border-t border-border-subtle">
                      <p className="text-xs text-ink-2">{step.message}</p>
                      {step.errorCount > 0 && <p className="text-2xs text-danger mt-1">{step.errorCount} error(s)</p>}
                      {step.warningCount > 0 && <p className="text-2xs text-warning mt-1">{step.warningCount} warning(s)</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Simulation Summary */}
        <section className="px-5 py-4">
          <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-3">Simulation Summary</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['Families Planned',   sim.totalFamiliesPlanned],
              ['Layers Affected',    sim.totalLayersAffected.toLocaleString()],
              ['Rollback Entries',   sim.rollbackEntries.length],
              ['Dependencies',       `${sim.dependenciesResolved} resolved, ${sim.criticalDependenciesMissing} missing`],
              ['Est. Execution Time', `~${estSec}s`],
              ['Blocked Families',   sim.blockedFamilyIds.length || '—'],
            ] as [string, string | number][]).map(([label, value]) => (
              <div key={label} className="bg-surface-1 border border-border rounded px-3 py-2">
                <p className="text-2xs text-ink-3 mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-ink tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          {sim.simulationErrors.length > 0 && (
            <div className="mt-3 space-y-1">
              {sim.simulationErrors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-danger">
                  <XCircle className="w-3 h-3 shrink-0 mt-0.5" /><span>{e}</span>
                </div>
              ))}
            </div>
          )}
          {sim.simulationWarnings.length > 0 && (
            <div className="mt-2 space-y-1">
              {sim.simulationWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-warning">
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /><span>{w}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-2xs text-ink-disabled mt-3 leading-relaxed">
            Execution time is an estimate based on layer count (≈10ms/layer).
            Actual time depends on document complexity and Figma performance.
          </p>
        </section>
      </div>
    </div>
  )
}
