import { cn } from '../../lib/cn'
import type { CandidateFamily } from '../../../similarity/types'
import type { SmartSuggestion } from '../../../suggestions/types'
import type { PlanningStatus } from '../../../shared/migration'
import { useMigrationStore } from '../../store/migration'

export type FamilyFilter =
  | 'all'
  | 'needs-review'
  | 'suggestions-available'
  | 'planned'
  | 'skipped'
  | 'high-confidence'
  | 'low-confidence'
  | 'no-suggestions'
  | 'raw-typography'
  | 'existing-styles'
  | 'variables'

export function applyFilter(
  families: CandidateFamily[],
  filter: FamilyFilter,
  entries: ReturnType<typeof useMigrationStore.getState>['plan']['entries'],
  allSuggestions: Map<string, SmartSuggestion[]>
): CandidateFamily[] {
  if (filter === 'all') return families
  return families.filter((f) => {
    const entry   = entries[f.id]
    const status  = entry?.status as PlanningStatus | undefined
    const sgs     = allSuggestions.get(f.id) ?? []

    switch (filter) {
      case 'needs-review':         return status === 'needs-review'
      case 'suggestions-available': return status === 'suggestions-available'
      case 'planned':              return status === 'planned' || status === 'modified'
      case 'skipped':              return status === 'skipped'
      case 'high-confidence':      return sgs.some(s => s.confidence >= 85)
      case 'low-confidence':       return sgs.length === 0 || sgs.every(s => s.confidence < 55)
      case 'no-suggestions':       return sgs.length === 0
      case 'raw-typography':       return Object.keys(f.sourceBreakdown).every(k => k === 'Raw Values' || k === 'Unknown')
      case 'existing-styles':      return entry?.target?.type === 'existing-style'
      case 'variables':            return entry?.target?.type === 'existing-variable'
      default:                     return true
    }
  })
}

const PRIMARY: { id: FamilyFilter; label: string }[] = [
  { id: 'all',                  label: 'All' },
  { id: 'needs-review',         label: 'Needs Review' },
  { id: 'suggestions-available', label: 'Suggestions' },
  { id: 'planned',              label: 'Planned' },
  { id: 'skipped',              label: 'Skipped' },
]

interface FamilyFiltersProps {
  active: FamilyFilter
  onChange: (f: FamilyFilter) => void
  families: CandidateFamily[]
  allSuggestions: Map<string, SmartSuggestion[]>
  entries: ReturnType<typeof useMigrationStore.getState>['plan']['entries']
}

export function FamilyFilters({ active, onChange, families, allSuggestions, entries }: FamilyFiltersProps) {
  function count(filter: FamilyFilter): number {
    return applyFilter(families, filter, entries, allSuggestions).length
  }

  return (
    <div className="flex items-center gap-0.5 border-b border-border shrink-0">
      {PRIMARY.map(({ id, label }) => {
        const c = count(id)
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={cn(
              'px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              active === id
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-3 hover:text-ink'
            )}
          >
            {label}
            {id !== 'all' && c > 0 && (
              <span className="ml-1.5 text-2xs text-ink-disabled">{c}</span>
            )}
            {id === 'all' && (
              <span className="ml-1.5 text-2xs text-ink-disabled">{families.length}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
