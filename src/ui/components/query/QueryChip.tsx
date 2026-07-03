import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { QueryCondition, QueryOperator } from '../../../query/types'
import { FIELD_META, OPERATOR_LABELS } from '../../../query/types'

const NUMERIC_OPERATORS: QueryOperator[] = ['eq', 'ne', 'gte', 'gt', 'lte', 'lt']

interface QueryChipProps {
  condition: QueryCondition
  onRemove:  () => void
  onToggle:  () => void
  onUpdate:  (update: Partial<Omit<QueryCondition, 'id'>>) => void
}

export function QueryChip({ condition, onRemove, onToggle, onUpdate }: QueryChipProps) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)
  const meta = FIELD_META[condition.field]

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const opLabel = OPERATOR_LABELS[condition.operator]
  const displayValue =
    meta.options?.find(o => o.value === String(condition.value))?.label ??
    String(condition.value)

  return (
    <div className={cn(
      'inline-flex items-center rounded border text-xs font-medium shrink-0 overflow-hidden',
      condition.enabled
        ? 'bg-accent-subtle border-accent/30 text-accent'
        : 'bg-surface-hover border-border text-ink-disabled'
    )}>
      {/* Label + operator */}
      <button
        onClick={() => onToggle()}
        className="px-2 py-1 hover:opacity-80 transition-opacity"
        title={condition.enabled ? 'Click to disable' : 'Click to enable'}
      >
        <span className="opacity-70">{meta.label}</span>
        <span className="mx-1 opacity-50">{opLabel}</span>
      </button>

      {/* Value (editable) */}
      {editing ? (
        <span className="px-1 py-1">
          {meta.type === 'enum' && meta.options ? (
            <select
              ref={inputRef as React.RefObject<HTMLSelectElement>}
              value={String(condition.value)}
              onChange={e => { onUpdate({ value: e.target.value }); setEditing(false) }}
              onBlur={() => setEditing(false)}
              className="bg-transparent border-none outline-none text-xs"
            >
              {meta.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : meta.type === 'number' ? (
            <span className="flex items-center gap-1">
              <select
                value={condition.operator}
                onChange={e => onUpdate({ operator: e.target.value as QueryOperator })}
                className="bg-transparent border-none outline-none text-xs"
              >
                {NUMERIC_OPERATORS.map(op => <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>)}
              </select>
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="number"
                value={Number(condition.value)}
                onChange={e => onUpdate({ value: Number(e.target.value) })}
                onBlur={() => setEditing(false)}
                onKeyDown={e => e.key === 'Enter' && setEditing(false)}
                className="w-14 bg-transparent border-none outline-none text-xs"
              />
            </span>
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={String(condition.value)}
              onChange={e => onUpdate({ value: e.target.value })}
              onBlur={() => setEditing(false)}
              onKeyDown={e => e.key === 'Enter' && setEditing(false)}
              className="w-24 bg-transparent border-none outline-none text-xs"
            />
          )}
        </span>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="px-1 py-1 font-semibold hover:opacity-80 transition-opacity"
          title="Click to edit value"
        >
          {displayValue || '…'}
        </button>
      )}

      {/* Remove */}
      <button
        onClick={onRemove}
        className="px-1.5 py-1 hover:opacity-80 transition-opacity border-l border-current/20"
        title="Remove condition"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
