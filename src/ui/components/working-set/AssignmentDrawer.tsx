import { useState } from 'react'
import { X, ChevronUp } from 'lucide-react'
import { cn } from '../../lib/cn'
import { AssignmentPanel } from '../clusters/AssignmentPanel'
import type { TypographyProperties } from '../../../modules/typography/types'
import type { ConsolidationTargetType } from '../../../shared/migration'

interface AssignmentDrawerProps {
  selectedIds:    string[]
  selectedGroups: import('../../../shared/types').AuditGroup<TypographyProperties>[]
  dominant:       TypographyProperties | undefined
  onDeselect:     () => void
  onAssigned?:    () => void
}

const TARGET_OPTIONS: Array<{ type: ConsolidationTargetType; label: string; description: string }> = [
  { type: 'existing-style',    label: 'Existing Library Style', description: 'Use a style from a shared library' },
  { type: 'existing-style',    label: 'Existing Local Style',   description: 'Use a style defined in this file'  },
  { type: 'existing-variable', label: 'Existing Variable',      description: 'Bind to a typography variable'     },
  { type: 'new-style',         label: 'Create New Style',       description: 'Plan a new text style'             },
  { type: 'new-variable',      label: 'Create New Variable',    description: 'Plan a new typography variable'    },
  { type: 'manual-values',     label: 'Manual Values',          description: 'Enter values directly'            },
  { type: 'skip',              label: 'Skip',                   description: 'Exclude from migration'            },
]

// Deduplicated target types for the form
const FORM_TABS: ConsolidationTargetType[] = [
  'existing-style', 'existing-variable', 'new-style', 'new-variable', 'manual-values', 'skip',
]

/**
 * AssignmentDrawer — the hero action in the Working Set workflow.
 *
 * Appears as a sticky bottom panel when Typography Signatures are selected.
 * Shows a selection summary and direct assignment actions.
 * No intermediate clustering step — the Working Set IS the cluster.
 */
export function AssignmentDrawer({
  selectedIds, selectedGroups, dominant, onDeselect, onAssigned,
}: AssignmentDrawerProps) {
  const [expanded, setExpanded] = useState(true)
  const [mode, setMode] = useState<ConsolidationTargetType | null>(null)

  const totalLayers = selectedGroups.reduce((s, g) => s + g.count, 0)
  const pages = new Set(selectedGroups.flatMap(g => g.items.map(i => i.pageId))).size
  const comps  = selectedGroups.reduce((s, g) => s + g.items.filter(i => i.parentType === 'COMPONENT' || i.parentType === 'INSTANCE').length, 0)

  const fallbackDominant: TypographyProperties = dominant ?? {
    fontFamily: 'Inter', fontStyle: 'Regular', fontWeight: 400, fontSize: 16,
    lineHeight: { unit: 'AUTO', value: 0 }, letterSpacing: { unit: 'PIXELS', value: 0 },
    textCase: 'ORIGINAL', textDecoration: 'NONE', source: { type: 'Raw' },
  }

  return (
    <div className="shrink-0 border-t-2 border-accent bg-surface-1">
      {/* Summary bar */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-ink">
            {selectedIds.length} signature{selectedIds.length !== 1 ? 's' : ''} selected
          </span>
          <span className="ml-2 text-xs text-ink-3">
            {totalLayers.toLocaleString()} layer{totalLayers !== 1 ? 's' : ''}
            {pages > 1 && <> · {pages} pages</>}
            {comps > 0 && <> · {comps.toLocaleString()} in components</>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded text-ink-3 hover:text-ink transition-colors"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            <ChevronUp className={cn('w-3.5 h-3.5 transition-transform', !expanded && 'rotate-180')} />
          </button>
          <button
            onClick={() => { setMode(null); onDeselect() }}
            className="p-1 rounded text-ink-3 hover:text-ink transition-colors"
            title="Clear selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Assignment options */}
      {expanded && (
        <div className="border-t border-border-subtle">
          {!mode ? (
            /* Target type picker */
            <div className="px-4 pb-3 pt-2">
              <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Assign to</p>
              <div className="flex flex-wrap gap-1.5">
                {FORM_TABS.map(type => {
                  const opt = TARGET_OPTIONS.find(o => o.type === type)
                  if (!opt) return null
                  return (
                    <button
                      key={type}
                      onClick={() => setMode(type)}
                      className="px-3 py-1.5 rounded border border-border bg-surface-0 text-xs font-medium text-ink-2 hover:border-border-strong hover:bg-surface-hover hover:text-ink transition-colors"
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Assignment form */
            <AssignmentPanel
              selectedIds={selectedIds}
              clusterId="working-set-selection"
              dominant={fallbackDominant}
              onClose={() => {
                setMode(null)
                onAssigned?.()
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}
