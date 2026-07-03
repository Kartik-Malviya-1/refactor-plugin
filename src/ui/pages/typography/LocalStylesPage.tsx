import { useMemo, useState } from 'react'
import { ChevronRight, CheckCircle, AlertTriangle } from 'lucide-react'
import { useAuditStore } from '../../store/audit'
import { cn } from '../../lib/cn'
import { formatLineHeight } from '../../../modules/typography/normalizer'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'

type HealthStatus = 'clean' | 'review' | 'fragmented'

function healthStatus(n: number): HealthStatus {
  return n === 1 ? 'clean' : n <= 3 ? 'review' : 'fragmented'
}

function HealthBadge({ count }: { count: number }) {
  const s = healthStatus(count)
  if (s === 'clean') {
    return (
      <span className="inline-flex items-center gap-1 text-2xs font-medium text-success">
        <CheckCircle className="w-3 h-3" />Clean
      </span>
    )
  }
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-2xs font-medium',
      s === 'fragmented' ? 'text-danger' : 'text-warning'
    )}>
      <AlertTriangle className="w-3 h-3" />{s === 'fragmented' ? 'Fragmented' : 'Needs Review'}
    </span>
  )
}

function SignatureDetail({ group }: { group: AuditGroup<TypographyProperties> }) {
  const p  = group.descriptor
  const lh = formatLineHeight(p.lineHeight)
  return (
    <div className="flex items-start gap-3 pl-8 pr-4 py-2 border-t border-border-subtle/50 bg-surface-0">
      <div className="w-1 h-1 rounded-full bg-border-strong shrink-0 mt-1.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-ink">{p.fontFamily}</p>
        <p className="text-2xs text-ink-3">
          {p.fontStyle} · {p.fontSize}px{lh !== 'Auto' && <> / {lh}</>}
        </p>
      </div>
      <span className="text-xs tabular-nums text-ink-2 shrink-0">
        {group.count.toLocaleString()} layer{group.count !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

interface StyleEntry {
  styleName: string
  groups: AuditGroup<TypographyProperties>[]
  totalLayers: number
}

export function LocalStylesPage() {
  const { result } = useAuditStore()
  const [expandedStyles, setExpandedStyles] = useState<Set<string>>(new Set())

  const groups = useMemo(() =>
    (result?.groups ?? []) as unknown as AuditGroup<TypographyProperties>[],
    [result]
  )

  const localGroups = useMemo(() =>
    groups.filter(g => g.source === 'Local Text Style'),
    [groups]
  )

  // Group by human-readable style name. Never use internal IDs.
  const styles = useMemo((): StyleEntry[] => {
    const styleMap = new Map<string, AuditGroup<TypographyProperties>[]>()

    for (const group of localGroups) {
      const src = group.descriptor.source
      // Human-readable name only — never internal styleId
      const styleName = src?.styleName ?? 'Unnamed Style'
      if (!styleMap.has(styleName)) styleMap.set(styleName, [])
      styleMap.get(styleName)!.push(group)
    }

    return [...styleMap.entries()]
      .map(([styleName, styleGroups]): StyleEntry => ({
        styleName,
        groups:      styleGroups,
        totalLayers: styleGroups.reduce((s, g) => s + g.count, 0),
      }))
      .sort((a, b) => b.totalLayers - a.totalLayers)
  }, [localGroups])

  const totalLayers = localGroups.reduce((s, g) => s + g.count, 0)

  function toggleStyle(name: string) {
    const next = new Set(expandedStyles)
    if (next.has(name)) next.delete(name); else next.add(name)
    setExpandedStyles(next)
  }

  if (!result) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-xs text-ink-disabled">No scan data. Run a scan first.</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-5 py-3 border-b border-border-subtle bg-surface-1">
        <p className="text-base font-semibold text-ink">Local Styles</p>
        <p className="text-xs text-ink-3 mt-0.5">
          {totalLayers.toLocaleString()} layers ·
          {' '}{localGroups.length} signature{localGroups.length !== 1 ? 's' : ''} ·
          {' '}{styles.length} style{styles.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {styles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-8 text-center">
            <p className="text-sm font-medium text-ink">No local styles detected</p>
            <p className="text-xs text-ink-3 leading-relaxed max-w-xs">
              Local styles appear when text layers use styles defined in this file.
            </p>
          </div>
        ) : styles.map(style => (
          <div key={style.styleName} className="border-b border-border-subtle">
            <button
              onClick={() => toggleStyle(style.styleName)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left"
            >
              <ChevronRight className={cn(
                'w-3.5 h-3.5 text-ink-3 shrink-0 transition-transform',
                expandedStyles.has(style.styleName) && 'rotate-90'
              )} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{style.styleName}</p>
                <p className="text-2xs text-ink-3">
                  {style.totalLayers.toLocaleString()} layer{style.totalLayers !== 1 ? 's' : ''} ·
                  {' '}{style.groups.length} signature{style.groups.length !== 1 ? 's' : ''}
                </p>
              </div>
              <HealthBadge count={style.groups.length} />
            </button>

            {expandedStyles.has(style.styleName) && style.groups.map(group => (
              <SignatureDetail key={group.id} group={group} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
