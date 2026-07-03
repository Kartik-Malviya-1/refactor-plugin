import { MousePointerClick, AlertTriangle } from 'lucide-react'
import { cn } from '../../lib/cn'
import { TypographyPreview } from '../audit/TypographyPreview'
import { useAssignmentStore } from '../../store/assignment'
import { useUIStore } from '../../store/ui'
import { locationFromItem } from '../../../shared/navigation'
import { sendToPlugin } from '../../hooks/useSendMessage'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'
import type { SourceType } from '../../../shared/types'

const SOURCE_BADGE: Partial<Record<SourceType, string>> = {
  'Raw Values':         'bg-surface-active text-ink-2 border border-border',
  'Local Text Style':   'bg-accent-subtle text-accent border border-accent/20',
  'Library Text Style': 'bg-success-subtle text-success border border-success/20',
  'Variable':           'bg-warning-subtle text-warning border border-warning/20',
  'Unknown':            'bg-surface-0 text-ink-disabled border border-border-subtle',
}

interface SignatureRowProps {
  group: AuditGroup<TypographyProperties>
  isSelected: boolean
  isOutlier: boolean
  onToggle: () => void
  onInspect: () => void
}

export function SignatureRow({ group, isSelected, isOutlier, onToggle, onInspect }: SignatureRowProps) {
  const assignment = useAssignmentStore(s => s.assignments[group.id])
  const { selectGroup, setSearchQuery, navigate } = useUIStore()
  const p = group.descriptor

  function handleNavigateAll(e: React.MouseEvent) {
    e.stopPropagation()
    const locations = group.items.map(locationFromItem)
    sendToPlugin({ type: 'SELECT_NODES', payload: { locations } })
  }

  function handleInspect(e: React.MouseEvent) {
    e.stopPropagation()
    setSearchQuery('')
    selectGroup(group.id)
    navigate('signatures')
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 border-b border-border-subtle last:border-0 transition-colors',
        isSelected ? 'bg-accent-subtle/30' : 'hover:bg-surface-hover'
      )}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        onClick={e => e.stopPropagation()}
        className="w-3.5 h-3.5 rounded accent-accent shrink-0 cursor-pointer"
      />

      {/* Preview */}
      <TypographyPreview properties={{ ...p, fontSize: Math.min(p.fontSize, 12) }} className="w-7 h-6 shrink-0" />

      {/* Properties */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-ink truncate">
          {p.fontFamily} {p.fontStyle} / {p.fontSize}px
        </p>
        <p className="text-2xs text-ink-3">{group.count.toLocaleString()} layers</p>
      </div>

      {/* Outlier flag */}
      {isOutlier && (
        <span title="Outlier: significantly differs from cluster dominant">
          <AlertTriangle className="w-3 h-3 text-warning shrink-0" />
        </span>
      )}

      {/* Source badge */}
      {group.source && SOURCE_BADGE[group.source as SourceType] && (
        <span className={cn('text-2xs px-1.5 py-0.5 rounded shrink-0 hidden sm:inline', SOURCE_BADGE[group.source as SourceType])}>
          {group.source === 'Local Text Style' ? 'Local'
            : group.source === 'Library Text Style' ? 'Library'
            : group.source}
        </span>
      )}

      {/* Assignment indicator */}
      {assignment && (
        <span className="text-2xs text-accent font-medium truncate max-w-[80px] shrink-0">
          → {assignment.label}
        </span>
      )}

      {/* Navigate to inspector */}
      <button onClick={handleInspect} className="p-1 rounded text-ink-3 hover:text-accent hover:bg-accent-subtle transition-colors shrink-0" title="Inspect in Typography Signatures">
        <MousePointerClick className="w-3 h-3" />
      </button>

      {/* Select all in Figma */}
      <button onClick={handleNavigateAll} className="p-1 rounded text-ink-3 hover:text-accent hover:bg-accent-subtle transition-colors shrink-0" title="Select all layers in Figma">
        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" />
          <rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" />
        </svg>
      </button>
    </div>
  )
}
