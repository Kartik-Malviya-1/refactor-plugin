import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useMigrationStore } from '../../store/migration'
import { useSessionLearning } from '../../hooks/useSessionLearning'
import type { CandidateFamily } from '../../../similarity/types'
import type { SmartSuggestion } from '../../../suggestions/types'
import { cn } from '../../lib/cn'

interface BulkActionsProps {
  families: CandidateFamily[]
  allSuggestions: Map<string, SmartSuggestion[]>
}

export function BulkActions({ families, allSuggestions }: BulkActionsProps) {
  const [open, setOpen] = useState(false)
  const { setTarget, resetAll, plan } = useMigrationStore()
  const { record } = useSessionLearning()

  function acceptFiltered(
    filter: (s: SmartSuggestion) => boolean,
    label: string
  ) {
    let count = 0
    for (const family of families) {
      const entry = plan.entries[family.id]
      if (!entry || entry.status === 'planned' || entry.status === 'skipped') continue
      const suggestions = allSuggestions.get(family.id) ?? []
      const top = suggestions.find(filter)
      if (!top) continue
      setTarget(family.id, top.target, 'suggestion')
      record({ familyId: family.id, target: top.target, dominantProps: family.dominant })
      count++
    }
    setOpen(false)
    if (count > 0) {
      console.log(`[Refactor] Bulk action: ${label} — ${count} families planned`)
    }
  }

  function handleResetAll() {
    resetAll()
    setOpen(false)
  }

  // Counts for each action
  const countAboveThreshold = (threshold: number) => families.filter((f) => {
    const e = plan.entries[f.id]
    if (!e || e.status === 'planned' || e.status === 'skipped') return false
    const sgs = allSuggestions.get(f.id) ?? []
    return sgs.some(s => s.confidence >= threshold)
  }).length

  const veryHighCount  = countAboveThreshold(90)
  const above85Count   = countAboveThreshold(85)
  const existingStyleCount = families.filter((f) => {
    const e = plan.entries[f.id]
    if (!e || e.status === 'planned' || e.status === 'skipped') return false
    return (allSuggestions.get(f.id) ?? []).some(s => s.targetType === 'existing-style')
  }).length
  const variableCount = families.filter((f) => {
    const e = plan.entries[f.id]
    if (!e || e.status === 'planned' || e.status === 'skipped') return false
    return (allSuggestions.get(f.id) ?? []).some(s => s.targetType === 'existing-variable')
  }).length

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 h-7 px-3 text-xs font-medium text-ink-2 bg-surface-1 border border-border rounded hover:border-border-strong transition-colors"
      >
        Bulk Actions
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 bg-surface-1 border border-border rounded-lg shadow-dropdown w-72 z-50 py-1">
          <p className="px-3 py-1.5 text-2xs font-semibold text-ink-disabled uppercase tracking-widest">
            Accept Suggestions
          </p>

          <button
            onClick={() => acceptFiltered(s => s.confidence >= 90, 'Very High ≥90%')}
            disabled={veryHighCount === 0}
            className="w-full text-left px-3 py-2 text-xs hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Accept Very High Confidence{' '}
            <span className="text-ink-3">({veryHighCount} families)</span>
          </button>

          <button
            onClick={() => acceptFiltered(s => s.confidence >= 85, 'High ≥85%')}
            disabled={above85Count === 0}
            className="w-full text-left px-3 py-2 text-xs hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Accept Suggestions Above 85%{' '}
            <span className="text-ink-3">({above85Count} families)</span>
          </button>

          <button
            onClick={() => acceptFiltered(s => s.targetType === 'existing-style', 'Existing Styles')}
            disabled={existingStyleCount === 0}
            className="w-full text-left px-3 py-2 text-xs hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Accept Existing Style Suggestions{' '}
            <span className="text-ink-3">({existingStyleCount} families)</span>
          </button>

          <button
            onClick={() => acceptFiltered(s => s.targetType === 'existing-variable', 'Variables')}
            disabled={variableCount === 0}
            className="w-full text-left px-3 py-2 text-xs hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Accept Variable Suggestions{' '}
            <span className="text-ink-3">({variableCount} families)</span>
          </button>

          <div className="my-1 border-t border-border-subtle" />

          <button
            onClick={handleResetAll}
            className="w-full text-left px-3 py-2 text-xs text-danger hover:bg-danger-subtle transition-colors"
          >
            Reset All to Needs Review
          </button>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  )
}
