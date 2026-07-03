import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'
import { TypographyPreview } from '../audit/TypographyPreview'
import { SignatureRow } from './SignatureRow'
import { AssignmentPanel } from './AssignmentPanel'
import { useAssignmentStore } from '../../store/assignment'
import type { TypographyCluster } from '../../../clustering/types'

const CONFIDENCE_STYLE = {
  'Very Strong':         'bg-success-subtle text-success border-success/20',
  'Strong':              'bg-accent-subtle text-accent border-accent/20',
  'Review Recommended':  'bg-warning-subtle text-warning border-warning/20',
  'Weak':                'bg-surface-0 text-ink-disabled border-border',
} as const

const REASON_STYLE = {
  match:     'bg-success-subtle text-success',
  similar:   'bg-accent-subtle text-accent',
  different: 'bg-surface-hover text-ink-3',
} as const

interface ClusterCardProps {
  cluster: TypographyCluster
}

export function ClusterCard({ cluster }: ClusterCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assignOpen, setAssignOpen] = useState(false)
  const { assignments, clear: clearAssignments } = useAssignmentStore()

  const memberIds = cluster.members.map(m => m.id)
  const allSelected   = memberIds.length > 0 && memberIds.every(id => selected.has(id))
  const noneSelected  = memberIds.every(id => !selected.has(id))
  const someSelected  = !allSelected && !noneSelected

  const assignedCount = memberIds.filter(id => assignments[id]).length
  const topReason = cluster.clusterReasons[0]

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }
  function selectAll() { setSelected(new Set(memberIds)) }
  function clearAll() { setSelected(new Set()) }
  function invertSelection() {
    const next = new Set<string>()
    for (const id of memberIds) { if (!selected.has(id)) next.add(id) }
    setSelected(next)
  }

  const selectedIds = [...selected]

  return (
    <div className="border-b border-border-subtle">
      {/* Collapsed row */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="grid items-center cursor-pointer hover:bg-surface-hover transition-colors px-3"
        style={{ gridTemplateColumns: '28px auto 1fr auto auto auto' }}
      >
        <div className="flex items-center justify-center h-11">
          <ChevronRight className={cn('w-3.5 h-3.5 text-ink-3 transition-transform duration-120', expanded && 'rotate-90')} />
        </div>

        {/* Confidence badge */}
        <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded border text-2xs font-medium mr-2 shrink-0', CONFIDENCE_STYLE[cluster.confidenceLabel])}>
          {cluster.confidence}%
        </span>

        {/* Family name + top reason */}
        <div className="min-w-0 py-2">
          <p className="text-xs font-medium text-ink truncate">
            {cluster.dominant.fontFamily} {cluster.dominant.fontStyle} / {cluster.dominant.fontSize}px
          </p>
          {topReason && (
            <p className="text-2xs text-ink-3 truncate">
              {topReason.description}
              {cluster.clusterReasons.length > 1 && (
                <span className="text-ink-disabled"> +{cluster.clusterReasons.length - 1} more</span>
              )}
            </p>
          )}
        </div>

        {/* Sig count */}
        <div className="text-xs text-ink-3 tabular-nums text-right px-2 shrink-0">
          {cluster.signatureCount} sigs
        </div>

        {/* Layers */}
        <div className="text-xs text-ink-2 font-medium tabular-nums text-right px-2 shrink-0">
          {cluster.totalLayers.toLocaleString()}
        </div>

        {/* Assignment status */}
        <div className="pl-2 pr-1 shrink-0">
          {assignedCount === cluster.signatureCount ? (
            <span className="text-2xs text-success font-medium">✓ Done</span>
          ) : assignedCount > 0 ? (
            <span className="text-2xs text-warning">{assignedCount}/{cluster.signatureCount}</span>
          ) : (
            <span className="text-2xs text-ink-disabled">—</span>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border-subtle bg-surface-0">
          {/* Cluster explanation */}
          <div className="px-4 py-2.5">
            <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Why this cluster?</p>
            <div className="flex flex-wrap gap-1.5">
              {cluster.clusterReasons.map((r, i) => (
                <span key={i} className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs', REASON_STYLE[r.type])}>
                  <span className="font-medium">{r.property}:</span>
                  <span className="opacity-80">{r.description}</span>
                </span>
              ))}
            </div>
            {cluster.outlierCount > 0 && (
              <p className="text-2xs text-warning mt-1.5">
                ⚠️ {cluster.outlierCount} outlier{cluster.outlierCount !== 1 ? 's' : ''} in this cluster
              </p>
            )}
          </div>

          {/* Bulk selection controls */}
          <div className="flex items-center gap-2 px-4 py-1.5 border-t border-border-subtle/50">
            <button onClick={selectAll}
              className={cn('text-2xs font-medium transition-colors', allSelected ? 'text-accent' : 'text-ink-3 hover:text-ink')}>
              All
            </button>
            <button onClick={clearAll}
              className={cn('text-2xs font-medium transition-colors', noneSelected ? 'text-accent' : 'text-ink-3 hover:text-ink')}>
              None
            </button>
            <button onClick={invertSelection} className="text-2xs font-medium text-ink-3 hover:text-ink transition-colors">
              Invert
            </button>
            {someSelected && (
              <span className="text-2xs text-ink-3 ml-1">{selectedIds.length} selected</span>
            )}
            {assignedCount > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); clearAssignments(memberIds) }}
                className="ml-auto text-2xs text-ink-disabled hover:text-danger transition-colors"
              >
                Clear cluster
              </button>
            )}
          </div>

          {/* Signature rows */}
          <div>
            {cluster.members.map(member => (
              <SignatureRow
                key={member.id}
                group={member}
                isSelected={selected.has(member.id)}
                isOutlier={cluster.outlierIds.has(member.id)}
                onToggle={() => toggle(member.id)}
                onInspect={() => {}}
              />
            ))}
          </div>

          {/* Assignment panel */}
          <div className="px-3 py-2.5 border-t border-border-subtle">
            <button
              onClick={() => setAssignOpen(!assignOpen)}
              disabled={selectedIds.length === 0}
              className={cn(
                'w-full h-7 rounded text-xs font-medium transition-colors',
                selectedIds.length > 0
                  ? 'bg-accent text-accent-fg hover:bg-accent-hover'
                  : 'bg-surface-hover text-ink-disabled cursor-not-allowed'
              )}
            >
              {selectedIds.length > 0
                ? `Assign ${selectedIds.length} signature${selectedIds.length !== 1 ? 's' : ''}`
                : 'Select signatures to assign'}
            </button>
          </div>

          {assignOpen && selectedIds.length > 0 && (
            <AssignmentPanel
              selectedIds={selectedIds}
              clusterId={cluster.id}
              dominant={cluster.dominant}
              onClose={() => setAssignOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}
