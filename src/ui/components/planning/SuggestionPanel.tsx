import { cn } from '../../lib/cn'
import type { SmartSuggestion } from '../../../suggestions/types'
import type { ConsolidationTargetType } from '../../../shared/migration'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONFIDENCE_COLOR: Record<string, string> = {
  'Very High': 'text-success',
  'High':      'text-accent',
  'Medium':    'text-warning',
  'Low':       'text-ink-3',
}

const CONFIDENCE_BG: Record<string, string> = {
  'Very High': 'bg-success-subtle border-success/20',
  'High':      'bg-accent-subtle border-accent/20',
  'Medium':    'bg-warning-subtle border-warning/20',
  'Low':       'bg-surface-0 border-border',
}

function targetLabel(s: SmartSuggestion): string {
  switch (s.targetType) {
    case 'existing-style':    return (s.target as { styleName: string }).styleName
    case 'existing-variable': return (s.target as { variableName: string }).variableName
    case 'new-style':         return 'Create New Style'
    case 'manual-values':     return 'Manual Values'
    case 'skip':              return 'Skip'
  }
}

function targetTypeLabel(type: ConsolidationTargetType): string {
  switch (type) {
    case 'existing-style':    return 'Use Existing Style'
    case 'existing-variable': return 'Use Variable'
    case 'new-style':         return 'Create New Style'
    case 'manual-values':     return 'Manual Values'
    case 'skip':              return 'Skip'
  }
}

// ---------------------------------------------------------------------------
// Compact suggestion row (used in collapsed card)
// ---------------------------------------------------------------------------

interface SuggestionRowProps {
  suggestion: SmartSuggestion
  totalCount: number
  onAccept: () => void
  onDismiss: () => void
  onShowAll: () => void
}

export function SuggestionRow({
  suggestion, totalCount, onAccept, onDismiss, onShowAll,
}: SuggestionRowProps) {
  return (
    <div className="flex items-center gap-2 pl-9 pr-3 py-1.5 bg-surface-0 border-t border-border-subtle/60">
      <span className="text-2xs text-ink-disabled shrink-0">Suggested</span>
      <span className="text-xs font-medium text-ink truncate flex-1">{targetLabel(suggestion)}</span>
      <span className={cn(
        'text-2xs px-1.5 py-0.5 rounded border tabular-nums shrink-0',
        CONFIDENCE_BG[suggestion.confidenceLabel]
      )}>
        <span className={CONFIDENCE_COLOR[suggestion.confidenceLabel]}>
          {suggestion.confidence}%
        </span>
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onAccept() }}
        className="text-2xs font-medium text-accent hover:text-accent-hover transition-colors shrink-0"
      >
        Accept
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss() }}
        className="text-2xs text-ink-disabled hover:text-ink-3 transition-colors shrink-0"
      >
        Dismiss
      </button>
      {totalCount > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onShowAll() }}
          className="text-2xs text-ink-disabled hover:text-ink-3 transition-colors shrink-0"
        >
          +{totalCount - 1}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Full suggestion panel (used in expanded card)
// ---------------------------------------------------------------------------

interface SuggestionPanelProps {
  suggestions: SmartSuggestion[]
  dismissedIds: Set<string>
  onAccept: (suggestion: SmartSuggestion) => void
  onDismiss: (suggestionId: string) => void
}

export function SuggestionPanel({
  suggestions, dismissedIds, onAccept, onDismiss,
}: SuggestionPanelProps) {
  const visible = suggestions.filter(s => !dismissedIds.has(s.id))

  if (visible.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-ink-disabled text-center">
        All suggestions dismissed. Use the target tabs below to plan manually.
      </div>
    )
  }

  return (
    <div className="space-y-2 px-4 pb-3">
      <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest pt-2">
        Smart Suggestions
      </p>
      {visible.map((s) => (
        <div key={s.id} className="border border-border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-surface-1">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-ink-disabled">{targetTypeLabel(s.targetType)}</p>
              <p className="text-sm font-medium text-ink truncate">{targetLabel(s)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className={cn('text-lg font-bold tabular-nums', CONFIDENCE_COLOR[s.confidenceLabel])}>
                {s.confidence}%
              </p>
              <p className={cn('text-2xs', CONFIDENCE_COLOR[s.confidenceLabel])}>
                {s.confidenceLabel}
              </p>
            </div>
          </div>

          {/* Reasons */}
          <div className="px-3 py-2 bg-surface-0 border-t border-border-subtle">
            <p className="text-2xs font-semibold text-ink-disabled mb-1">Why?</p>
            <ul className="space-y-0.5">
              {s.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-ink-2">
                  <span className="shrink-0 text-border-strong mt-0.5">•</span>
                  <span>
                    {r.text}
                    {r.evidence && (
                      <span className="text-ink-disabled ml-1">({r.evidence})</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Impact */}
          <div className="flex items-center gap-3 px-3 py-1.5 bg-surface-0 border-t border-border-subtle text-2xs text-ink-3">
            <span>Estimated Impact</span>
            <span className="font-medium text-ink-2">{s.estimatedImpact.layers.toLocaleString()} layers</span>
            {s.estimatedImpact.components > 0 && (
              <span>{s.estimatedImpact.components.toLocaleString()} components</span>
            )}
            <span>{s.estimatedImpact.pages} {s.estimatedImpact.pages === 1 ? 'page' : 'pages'}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 px-3 py-2 bg-surface-1 border-t border-border-subtle">
            <button
              onClick={() => onAccept(s)}
              className="flex-1 h-6 rounded bg-accent text-accent-fg text-xs font-medium hover:bg-accent-hover transition-colors"
            >
              Accept
            </button>
            <button
              onClick={() => onDismiss(s.id)}
              className="px-3 h-6 rounded border border-border text-xs text-ink-3 hover:text-ink hover:border-border-strong transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
