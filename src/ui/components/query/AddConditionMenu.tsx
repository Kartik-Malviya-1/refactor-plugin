import { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import type { QueryCondition } from '../../../query/types'
import { FIELD_CATEGORIES, FIELD_META } from '../../../query/types'

interface AddConditionMenuProps {
  onAdd: (cond: Omit<QueryCondition, 'id'>) => void
}

export function AddConditionMenu({ onAdd }: AddConditionMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  function handleSelect(field: (typeof FIELD_CATEGORIES)[0]['fields'][0]) {
    const meta = FIELD_META[field]
    onAdd({
      field,
      operator: meta.defaultOperator,
      value:    meta.defaultValue,
      enabled:  true,
    })
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-dashed border-border text-xs text-ink-3 hover:text-ink hover:border-border-strong transition-colors"
      >
        <Plus className="w-3 h-3" />Add Condition
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-surface-1 border border-border rounded-lg shadow-dropdown z-50 py-1 min-w-[180px]">
          {FIELD_CATEGORIES.map(cat => (
            <div key={cat.label}>
              <p className="px-3 py-1 text-2xs font-semibold text-ink-disabled uppercase tracking-widest">{cat.label}</p>
              {cat.fields.map(field => (
                <button
                  key={field}
                  onClick={() => handleSelect(field)}
                  className="w-full text-left px-3 py-1.5 text-xs text-ink-2 hover:bg-surface-hover hover:text-ink transition-colors"
                >
                  {FIELD_META[field].label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
