import { useState, useEffect } from 'react'
import { MousePointerClick, X, Map, Eye, RefreshCw, Layers } from 'lucide-react'
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
import type { SourceType } from '../../../shared/types'
import { UsageExplorer } from './UsageExplorer'
import { _usageExplorerListeners } from '../../hooks/usePluginMessage'

const SOURCE_BADGE: Partial<Record<SourceType, string>> = {
  'Raw Values':         'bg-surface-active text-ink-2 border border-border',
  'Local Text Style':   'bg-accent-subtle text-accent border border-accent/20',
  'Library Text Style': 'bg-success-subtle text-success border border-success/20',
  'Variable':           'bg-warning-subtle text-warning border border-warning/20',
  'Unknown':            'bg-surface-0 text-ink-disabled border border-border-subtle',
}

interface TypographyInspectorProps {
  group: AuditGroup<TypographyProperties>
}

export function TypographyInspector({ group }: TypographyInspectorProps) {
  const { selectGroup, currentPageId } = useUIStore()
  const [usageExplorerOpen, setUsageExplorerOpen] = useState(false)
  const p = group.descriptor
  const source = p.source
  const sourceLabel: SourceType = (group.source as SourceType) ?? 'Raw Values'

  // Listen for SHOW_USAGE_EXPLORER from plugin
  useEffect(() => {
    const cb = () => setUsageExplorerOpen(true)
    _usageExplorerListeners.push(cb)
    return () => {
      const idx = _usageExplorerListeners.indexOf(cb)
      if (idx >= 0) _usageExplorerListeners.splice(idx, 1)
    }
  }, [])

  function handleSelectAll() {
    const locations = group.items.map(locationFromItem)
    // Check if all items are on the same page (and ideally current page)
    const uniquePages = new Set(group.items.map(i => i.pageId))
    if (uniquePages.size > 1) {
      // Multi-page: open Usage Explorer, plugin will also send SHOW_USAGE_EXPLORER
      setUsageExplorerOpen(true)
      return
    }
    // Single page: use native selection (fast, no freeze)
    sendToPlugin({ type: 'SELECT_NODES', payload: { locations } })
  }

  function handleSelectLayer(item: (typeof group.items)[0]) {
    sendToPlugin({ type: 'SELECT_NODES', payload: { locations: [locationFromItem(item)] } })
  }

  const uniquePages = new Set(group.items.map(i => i.pageId))
  const isMultiPage = uniquePages.size > 1

  // Source display
  const sourceDisplay =
    source?.styleName ?? (sourceLabel === 'Raw Values' ? 'No style' : sourceLabel)
  const libraryDisplay = source?.libraryName

  if (usageExplorerOpen) {
    return (
      <aside className="w-[260px] shrink-0 bg-surface-1 border-l border-border flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
          <span className="text-xs font-semibold text-ink flex-1 truncate">{group.label}</span>
          <button onClick={() => selectGroup(null)} className="p-0.5 rounded text-ink-3 hover:text-ink transition-colors"><X className="w-3.5 h-3.5" /></button>
        </div>
        <UsageExplorer
          items={group.items as AuditGroup<TypographyProperties>['items']}
          onClose={() => setUsageExplorerOpen(false)}
        />
      </aside>
    )
  }

  return (
    <aside className="w-[260px] shrink-0 bg-surface-1 border-l border-border flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-ink flex-1 truncate">Style Inspector</span>
        <button onClick={() => selectGroup(null)} className="p-0.5 rounded text-ink-3 hover:text-ink transition-colors"><X className="w-3.5 h-3.5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-center h-20 border-b border-border-subtle bg-surface-0">
          <TypographyPreview properties={{ ...p, fontSize: Math.min(p.fontSize, 28) }} className="w-full h-full" />
        </div>

        <div className="px-3 py-2.5 border-b border-border-subtle">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-ink truncate flex-1">{group.label}</p>
            <Badge variant="default">{group.count}</Badge>
          </div>
        </div>

        {/* Properties */}
        <div className="px-3 py-2">
          <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-1.5">Properties</p>
          {/* Source row */}
          <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-border-subtle">
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-ink-3">Source</span>
              <InfoButton definition={DEFINITIONS.source} side="right" />
            </div>
            <div className="text-right min-w-0">
              {SOURCE_BADGE[sourceLabel] && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium ${SOURCE_BADGE[sourceLabel]}`}>{sourceLabel}</span>
              )}
              {sourceDisplay && sourceDisplay !== sourceLabel && (
                <p className="text-2xs text-ink-disabled mt-0.5 truncate max-w-[120px]">{sourceDisplay}</p>
              )}
              {libraryDisplay && (
                <p className="text-2xs text-ink-disabled truncate max-w-[120px]">{libraryDisplay}</p>
              )}
            </div>
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
            {isMultiPage ? (
              <Button variant="primary" size="sm" className="w-full justify-start" onClick={() => setUsageExplorerOpen(true)}>
                <Layers className="w-3.5 h-3.5" />Usage Explorer ({uniquePages.size} pages)
              </Button>
            ) : (
              <Button variant="primary" size="sm" className="w-full justify-start" onClick={handleSelectAll}>
                <MousePointerClick className="w-3.5 h-3.5" />Select All Layers
              </Button>
            )}
            <div className="relative"><Button disabled variant="secondary" size="sm" className="w-full justify-start"><Map className="w-3.5 h-3.5" />Map to Variable</Button><span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-ink-disabled">Soon</span></div>
            <div className="relative"><Button disabled variant="secondary" size="sm" className="w-full justify-start"><Eye className="w-3.5 h-3.5" />Preview Changes</Button><span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-ink-disabled">Soon</span></div>
            <div className="relative"><Button disabled variant="secondary" size="sm" className="w-full justify-start"><RefreshCw className="w-3.5 h-3.5" />Replace Style</Button><span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-ink-disabled">Soon</span></div>
          </div>
        </div>

        {/* Layers */}
        <div className="border-t border-border-subtle">
          <div className="px-3 py-2">
            <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest">Layers ({group.count})</p>
          </div>
          <div className="pb-2">
            {group.items.map((item) => (
              <button key={item.id} onClick={() => handleSelectLayer(item)}
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
