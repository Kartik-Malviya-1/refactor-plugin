import { cn } from '../../lib/cn'
import { QueryChip } from './QueryChip'
import { AddConditionMenu } from './AddConditionMenu'
import type { QueryCondition, WorkingSetStatistics } from '../../../query/types'

interface QueryBuilderProps {
  conditions: QueryCondition[]
  statistics?: WorkingSetStatistics
  onAdd:    (cond: Omit<QueryCondition, 'id'>) => void
  onRemove: (id: string) => void
  onUpdate: (id: string, update: Partial<Omit<QueryCondition, 'id'>>) => void
  onToggle: (id: string) => void
  onClear:  () => void
}

/**
 * Query Builder — primary interaction model for defining a Working Set.
 *
 * Conditions appear as removable chips with AND semantics.
 * Future: OR groups, saved Working Sets, drag-to-reorder.
 */
export function QueryBuilder({
  conditions, statistics,
  onAdd, onRemove, onUpdate, onToggle, onClear,
}: QueryBuilderProps) {
  return (
    <div className="shrink-0 border-b border-border bg-surface-1">
      {/* Chip row */}
      <div className="flex items-center gap-1.5 flex-wrap px-4 py-2.5 min-h-[44px]">
        {conditions.length === 0 && (
          <span className="text-xs text-ink-disabled italic">Working Set: all signatures</span>
        )}
        {conditions.map((cond, i) => (
          <>
            {i > 0 && <span key={`and-${cond.id}`} className="text-2xs text-ink-disabled font-medium">AND</span>}
            <QueryChip
              key={cond.id}
              condition={cond}
              onRemove={() => onRemove(cond.id)}
              onToggle={() => onToggle(cond.id)}
              onUpdate={(u) => onUpdate(cond.id, u)}
            />
          </>
        ))}
        <AddConditionMenu onAdd={onAdd} />
        {conditions.length > 0 && (
          <button
            onClick={onClear}
            className="text-2xs text-ink-disabled hover:text-ink-3 transition-colors ml-1"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Working Set statistics */}
      {statistics && (
        <div className={cn(
          'flex items-center gap-3 px-4 py-1.5 border-t border-border-subtle text-2xs text-ink-3',
          statistics.signatureCount === 0 && 'text-ink-disabled'
        )}>
          <span className="font-medium text-ink-2">Working Set</span>
          <span>{statistics.signatureCount.toLocaleString()} signature{statistics.signatureCount !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{statistics.layerCount.toLocaleString()} layers</span>
          {statistics.pageCount > 1 && <><span>·</span><span>{statistics.pageCount} pages</span></>}
          {statistics.potentialConsolidations > 0 && (
            <>
              <span>·</span>
              <span className="text-accent font-medium">{statistics.potentialConsolidations} consolidation{statistics.potentialConsolidations !== 1 ? 's' : ''}</span>
            </>
          )}
          {statistics.estimatedReduction > 0 && (
            <span className="text-ink-disabled">
              → {statistics.signatureCount - statistics.estimatedReduction} signatures
            </span>
          )}
        </div>
      )}
    </div>
  )
}
