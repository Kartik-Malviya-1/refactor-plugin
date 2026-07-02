import { useMemo } from 'react'
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
import type { SourceType } from '../../../shared/types'

interface TypographyInspectorProps {
  group: AuditGroup<TypographyProperties>
}

const SOURCE_BADGE: Record<SourceType, string> = {
  'Raw Values':          'bg-surface-active text-ink-2 border border-border',
  'Local Text Style':    'bg-accent-subtle text-accent border border-accent/20',
  'Library Text Style':  'bg-success-subtle text-success border border-success/20',
  'Variable':            'bg-warning-subtle text-warning border border-warning/20',
  'Unknown':             'bg-surface-0 text-ink-disabled border border-border-subtle',
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-t border-border-subtle">
      <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest flex-1">{title}</p>
      {action}
    </div>
  )
}

export function TypographyInspector({ group }: TypographyInspectorProps) {
  const { selectGroup } = useUIStore()
  const p = group.descriptor
  const source: SourceType = (group.source as SourceType) ?? 'Unknown'

  // ── Usage + Structure stats (computed from items) ───────────────────
  const usage = useMemo(() => {
    const pages = new Set<string>()
    const parentTypes = new Map<string, number>()
    let frames = 0, components = 0, instances = 0, variants = 0, autoLayout = 0

    for (const item of group.items) {
      pages.add(item.pageId)
      if (item.parentType) {
        parentTypes.set(item.parentType, (parentTypes.get(item.parentType) ?? 0) + 1)
      }
      switch (item.parentType) {
        case 'FRAME':         frames++;     break
        case 'COMPONENT':     components++; break
        case 'INSTANCE':      instances++;  break
        case 'COMPONENT_SET': variants++;   break
      }
      if (item.hasAutoLayoutParent) autoLayout++
    }

    // Sort parent types by count for structure breakdown
    const typeList = [...parentTypes.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count, pct: Math.round((count / group.count) * 100) }))

    return { pages: pages.size, frames, components, instances, variants, autoLayout, typeList }
  }, [group])

  function handleSelectAll() {
    sendToPlugin({ type: 'SELECT_NODES', payload: { locations: group.items.map(locationFromItem) } })
  }

  function handleSelectLayer(item: (typeof group.items)[0]) {
    sendToPlugin({ type: 'SELECT_NODES', payload: { locations: [locationFromItem(item)] } })
  }

  return (
    <aside className="w-[260px] shrink-0 bg-surface-1 border-l border-border flex flex-col h-full overflow-hidden">
      {/* Inspector header */}
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

        {/* ── Properties ────────────────────────────────────────── */}
        <SectionHeader title="Properties" />
        <div className="px-3 pb-2">
          <PropertyRow label="Font Family"    value={p.fontFamily} />
          <PropertyRow label="Weight"         value={`${p.fontStyle} (${p.fontWeight})`} />
          <PropertyRow label="Size"           value={`${p.fontSize}px`} />
          <PropertyRow label="Line Height"    value={formatLineHeight(p.lineHeight)} />
          <PropertyRow label="Letter Spacing" value={formatLetterSpacing(p.letterSpacing)} />
          <PropertyRow label="Text Case"      value={formatTextCase(p.textCase)} />
          <PropertyRow label="Decoration"     value={formatTextDecoration(p.textDecoration)} />
        </div>

        {/* ── Source ───────────────────────────────────────────── */}
        <SectionHeader title="Source" action={<InfoButton definition={DEFINITIONS.source} side="right" />} />
        <div className="px-3 pb-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SOURCE_BADGE[source]}`}>
            {source}
          </span>
          {p.textStyleId && (
            <p className="text-2xs text-ink-disabled mt-1 font-mono break-all">{p.textStyleId}</p>
          )}
        </div>

        {/* ── Usage ────────────────────────────────────────────── */}
        <SectionHeader title="Usage" />
        <div className="px-3 pb-3 grid grid-cols-2 gap-x-4 gap-y-1">
          {([
            ['Layers',     group.count],
            ['Pages',      usage.pages],
            ['Frames',     usage.frames],
            ['Components', usage.components],
            ['Instances',  usage.instances],
            ['Variants',   usage.variants],
            ['Auto Layout',usage.autoLayout],
          ] as [string, number][]).map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-ink-3">{label}</span>
              <span className="text-xs font-semibold text-ink tabular-nums">{value.toLocaleString()}</span>
            </div>
          ))}
        </div>

        {/* ── Structure ─────────────────────────────────────────── */}
        {usage.typeList.length > 0 && (
          <>
            <SectionHeader title="Structure" />
            <div className="px-3 pb-3 space-y-1.5">
              {usage.typeList.map(({ type, count, pct }) => (
                <div key={type}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-ink-3">{type}</span>
                    <span className="text-xs text-ink-2 tabular-nums">{count.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div className="h-1 bg-surface-hover rounded-full overflow-hidden">
                    <div className="h-full bg-accent/40 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Navigation ────────────────────────────────────────── */}
        <SectionHeader title="Navigation" />
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          <Button variant="primary" size="sm" className="w-full justify-start" onClick={handleSelectAll}>
            <MousePointerClick className="w-3.5 h-3.5" />Select All Layers
          </Button>
          <div className="relative">
            <Button disabled variant="secondary" size="sm" className="w-full justify-start"><Map className="w-3.5 h-3.5" />Map to Variable</Button>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-ink-disabled">Soon</span>
          </div>
          <div className="relative">
            <Button disabled variant="secondary" size="sm" className="w-full justify-start"><Eye className="w-3.5 h-3.5" />Preview Changes</Button>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-ink-disabled">Soon</span>
          </div>
          <div className="relative">
            <Button disabled variant="secondary" size="sm" className="w-full justify-start"><RefreshCw className="w-3.5 h-3.5" />Replace Style</Button>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-ink-disabled">Soon</span>
          </div>
        </div>

        {/* ── Layers ────────────────────────────────────────────── */}
        <SectionHeader title={`Layers (${group.count})`} />
        <div className="pb-3">
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
    </aside>
  )
}
