import { memo } from 'react'
import { ChevronRight, MousePointerClick } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'
import { TypographyPreview } from './TypographyPreview'
import { Badge } from '../ui/Badge'
import { formatLineHeight, formatLetterSpacing } from '../../../modules/typography/normalizer'
import { sendToPlugin } from '../../hooks/useSendMessage'
import { locationFromItem } from '../../../shared/navigation'

interface GroupRowProps {
  group: AuditGroup<TypographyProperties>
  isSelected: boolean
  isExpanded: boolean
  onSelect: (groupId: string) => void
  onToggleExpand: (groupId: string) => void
  rank: number
}

const COL_WIDTHS = '52px 1fr 80px 58px 70px 72px 64px 36px'

export const GroupRow = memo(function GroupRow({
  group,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  rank,
}: GroupRowProps) {
  const p = group.descriptor

  function handleSelectAll(e: React.MouseEvent) {
    e.stopPropagation()
    // Build NodeLocation[] from group items so the plugin can switch pages.
    const locations = group.items.map(locationFromItem)
    sendToPlugin({ type: 'SELECT_NODES', payload: { locations } })
  }

  function handleSelectItem(item: (typeof group.items)[0]) {
    sendToPlugin({
      type: 'SELECT_NODES',
      payload: { locations: [locationFromItem(item)] },
    })
  }

  return (
    <>
      <div
        role="row"
        onClick={() => onSelect(group.id)}
        className={cn(
          'grid items-center text-sm cursor-pointer select-none transition-colors duration-120 border-b border-border-subtle',
          isSelected ? 'bg-accent-subtle' : 'hover:bg-surface-hover'
        )}
        style={{ gridTemplateColumns: COL_WIDTHS }}
      >
        <div className="flex items-center justify-center h-10 pl-1">
          <TypographyPreview properties={p} className="w-10 h-8" />
        </div>
        <div className="flex flex-col gap-0.5 py-2 pr-2 min-w-0">
          <span className="font-medium text-ink truncate leading-tight">{p.fontFamily}</span>
          <span className="text-xs text-ink-3 truncate">{p.fontStyle}</span>
        </div>
        <div className="text-ink-2 tabular-nums pr-2">{p.fontSize}px</div>
        <div className="text-ink-2 tabular-nums pr-2">{formatLineHeight(p.lineHeight)}</div>
        <div className="text-ink-2 tabular-nums pr-2">{formatLetterSpacing(p.letterSpacing)}</div>
        <div className="flex items-center gap-1.5 pr-2">
          <Badge variant={rank === 0 ? 'accent' : 'default'}>{group.count}</Badge>
        </div>
        <div className="flex items-center justify-center">
          <button
            onClick={handleSelectAll}
            className="p-1 rounded text-ink-3 hover:text-accent hover:bg-accent-subtle transition-colors"
            title="Select all in Figma"
          >
            <MousePointerClick className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center justify-center">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(group.id) }}
            className="p-1 rounded text-ink-3 hover:text-ink transition-colors"
          >
            <ChevronRight className={cn('w-3.5 h-3.5 transition-transform duration-120', isExpanded && 'rotate-90')} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="bg-surface-0 border-b border-border-subtle">
          {group.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-1.5 text-xs text-ink-2 hover:bg-surface-hover transition-colors border-b border-border-subtle last:border-0"
            >
              <div className="w-1 h-1 rounded-full bg-border-strong shrink-0" />
              <span className="flex-1 truncate font-medium text-ink">{item.nodeName}</span>
              {item.parentName && <span className="text-ink-disabled truncate max-w-[120px]">{item.parentName}</span>}
              <span className="text-ink-disabled shrink-0">{item.pageName}</span>
              <button
                onClick={() => handleSelectItem(item)}
                className="shrink-0 text-ink-3 hover:text-accent transition-colors"
                title="Select in Figma"
              >
                <MousePointerClick className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
})
