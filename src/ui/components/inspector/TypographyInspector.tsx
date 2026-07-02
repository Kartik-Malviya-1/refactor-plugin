import { MousePointerClick, X, Map, Eye, RefreshCw } from 'lucide-react'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'
import { formatLineHeight, formatLetterSpacing, formatTextCase, formatTextDecoration } from '../../../modules/typography/normalizer'
import { PropertyRow } from './PropertyRow'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { InfoButton } from '../ui/InfoButton'
import { TypographyPreview } from '../audit/TypographyPreview'
import { sendToPlugin } from '../../hooks/useSendMessage'
import { useUIStore } from '../../store/ui'
import { locationFromItem } from '../../../shared/navigation'
import { DEFINITIONS } from '../../lib/definitions'

interface TypographyInspectorProps {
  group: AuditGroup<TypographyProperties>
}

export function TypographyInspector({ group }: TypographyInspectorProps) {
  const { selectGroup } = useUIStore()
  const p = group.descriptor

  function handleSelectAll() {
    const locations = group.items.map(locationFromItem)
    sendToPlugin({ type: 'SELECT_NODES', payload: { locations } })
  }

  function handleSelectLayer(item: (typeof group.items)[0]) {
    sendToPlugin({
      type: 'SELECT_NODES',
      payload: { locations: [locationFromItem(item)] },
    })
  }

  return (
    <aside className="w-[248px] shrink-0 bg-surface-1 border-l border-border flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-ink flex-1 truncate">Style Inspector</span>
        <button onClick={() => selectGroup(null)} className="p-0.5 rounded text-ink-3 hover:text-ink transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Preview */}
        <div className="flex items-center justify-center h-20 border-b border-border-subtle bg-surface-0">
          <TypographyPreview properties={{ ...p, fontSize: Math.min(p.fontSize, 28) }} className="w-full h-full" />
        </div>

        {/* Label + count */}
        <div className="px-3 py-2.5 border-b border-border-subtle">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-ink truncate flex-1">{group.label}</p>
            <Badge variant="default">{group.count}</Badge>
          </div>
        </div>

        {/* Properties */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest">Properties</p>
          </div>

          {/* Source classification */}
          <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-border-subtle">
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-ink-3">Source</span>
              <InfoButton definition={DEFINITIONS.source} side="right" />
            </div>
            <span className="text-xs text-ink-disabled text-right">
              Unknown
            </span>
          </div>

          <PropertyRow label="Font Family"    value={p.fontFamily} />
          <PropertyRow label="Weight"         value={`${p.fontStyle} (${p.fontWeight})`} />
          <PropertyRow label="Size"           value={`${p.fontSize}px`} />
          <PropertyRow label="Line Height"    value={formatLineHeight(p.lineHeight)} />
          <PropertyRow label="Letter Spacing" value={formatLetterSpacing(p.letterSpacing)} />
          <PropertyRow label="Text Case"      value={formatTextCase(p.textCase)} />
          <PropertyRow label="Decoration"     value={formatTextDecoration(p.textDecoration)} />
        </div>

        {/* Actions */}
        <div className="px-3 py-2 border-t border-border-subtle">
          <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Actions</p>
          <div className="flex flex-col gap-1.5">
            <Button variant="primary" size="sm" className="w-full justify-start" onClick={handleSelectAll}>
              <MousePointerClick className="w-3.5 h-3.5" />Select All Layers
            </Button>
            <div className="relative">
              <Button disabled variant="secondary" size="sm" className="w-full justify-start">
                <Map className="w-3.5 h-3.5" />Map to Variable
              </Button>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-ink-disabled">Soon</span>
            </div>
            <div className="relative">
              <Button disabled variant="secondary" size="sm" className="w-full justify-start">
                <Eye className="w-3.5 h-3.5" />Preview Changes
              </Button>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-ink-disabled">Soon</span>
            </div>
            <div className="relative">
              <Button disabled variant="secondary" size="sm" className="w-full justify-start">
                <RefreshCw className="w-3.5 h-3.5" />Replace Style
              </Button>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-ink-disabled">Soon</span>
            </div>
          </div>
        </div>

        {/* Affected layers */}
        <div className="border-t border-border-subtle">
          <div className="px-3 py-2">
            <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest">
              Layers ({group.count})
            </p>
          </div>
          <div className="pb-2">
            {group.items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectLayer(item)}
                className="w-full flex items-start gap-2 px-3 py-1.5 hover:bg-surface-hover transition-colors text-left"
                title={`Navigate to layer on ${item.pageName}`}
              >
                <div className="w-1 h-1 rounded-full bg-border-strong shrink-0 mt-1.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-ink truncate">{item.nodeName}</p>
                  {item.parentName && <p className="text-2xs text-ink-3 truncate">{item.parentName}</p>}
                  <p className="text-2xs text-ink-disabled truncate">{item.pageName}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}
