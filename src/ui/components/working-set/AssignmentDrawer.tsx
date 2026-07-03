import { useState } from 'react'
import { X, ChevronUp } from 'lucide-react'
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

// Simplified target options. Library vs Local style distinction is handled
// inside the style picker (user can search the full list of available styles).
const TARGET_BUTTONS: Array<{ type: ConsolidationTargetType; label: string }> = [
  { type: 'existing-style',    label: 'Use Existing Style'    },
  { type: 'existing-variable', label: 'Use Variable'          },
  { type: 'new-style',         label: 'Create New Style'      },
  { type: 'new-variable',      label: 'Create New Variable'   },
  { type: 'manual-values',     label: 'Manual Values'         },
  { type: 'skip',              label: 'Skip'                  },
]

/**
 * AssignmentDrawer — sticky bottom panel, the hero action in the Working Set workflow.
 *
 * Bug fix (v0.2.4): the drawer’s chosen mode is now passed as initialMode
 * to AssignmentPanel so the correct tab is pre-selected on open.
 * Previously AssignmentPanel always started in its null state (empty),
 * requiring the user to click the tab a second time.
 */
export function AssignmentDrawer({
  selectedIds, selectedGroups, dominant, onDeselect, onAssigned,
}: AssignmentDrawerProps) {
  const [expanded, setExpanded] = useState(true)
  const [mode, setMode]         = useState<ConsolidationTargetType | null>(null)

  const totalLayers = selectedGroups.reduce((s, g) => s + g.count, 0)
  const pages       = new Set(selectedGroups.flatMap(g => g.items.map(i => i.pageId))).size
  const comps       = selectedGroups.reduce(
    (s, g) => s + g.items.filter(i => i.parentType === 'COMPONENT' || i.parentType === 'INSTANCE').length,
    0
  )

  const fallback: TypographyProperties = dominant ?? {
    fontFamily: 'Inter', fontStyle: 'Regular', fontWeight: 400, fontSize: 16,
    lineHeight: { unit: 'AUTO', value: 0 },
    letterSpacing: { unit: 'PIXELS', value: 0 },
    textCase: 'ORIGINAL', textDecoration: 'NONE',
    source: { type: 'Raw' },
  }

  function handleButtonClick(type: ConsolidationTargetType) {
    console.log('[Refactor] Assign button clicked:', type, { selectedIds })
    setMode(type)
  }

  function handlePanelClose() {
    console.log('[Refactor] Assignment panel closed, clearing selection')
    setMode(null)
    onAssigned?.()
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
            {comps > 0  && <> · {comps.toLocaleString()} in components</>}
          </span>
        </div>
        <button onClick={() => setExpanded(!expanded)}
          className="p-1 rounded text-ink-3 hover:text-ink transition-colors"
          title={expanded ? 'Collapse' : 'Expand'}>
          <ChevronUp className={`w-3.5 h-3.5 transition-transform ${!expanded ? 'rotate-180' : ''}`} />
        </button>
        <button onClick={() => { setMode(null); onDeselect() }}
          className="p-1 rounded text-ink-3 hover:text-ink transition-colors"
          title="Clear selection">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border-subtle">
          {!mode ? (
            /* Target type picker */
            <div className="px-4 pb-3 pt-2">
              <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Assign to</p>
              <div className="flex flex-wrap gap-1.5">
                {TARGET_BUTTONS.map(btn => (
                  <button
                    key={btn.type}
                    onClick={() => handleButtonClick(btn.type)}
                    className="px-3 py-1.5 rounded border border-border bg-surface-0 text-xs font-medium text-ink-2 hover:border-border-strong hover:bg-surface-hover hover:text-ink transition-colors"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Bug fix: pass initialMode so AssignmentPanel opens on the correct tab.
            // Previously, AssignmentPanel always started with mode=null (showing
            // “Choose an assignment type above”) even after the user had clicked a button.
            <AssignmentPanel
              selectedIds={selectedIds}
              clusterId="working-set-selection"
              dominant={fallback}
              initialMode={mode}
              onClose={handlePanelClose}
            />
          )}
        </div>
      )}
    </div>
  )
}
