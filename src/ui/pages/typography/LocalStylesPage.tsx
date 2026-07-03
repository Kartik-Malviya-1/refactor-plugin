import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useAuditStore } from '../../store/audit'
import { cn } from '../../lib/cn'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'

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

  // Group by style name
  const styles = useMemo(() => {
    const styleMap = new Map<string, AuditGroup<TypographyProperties>[]>()
    for (const group of localGroups) {
      const styleName = group.descriptor.source?.styleName ?? group.descriptor.textStyleId ?? 'Unknown Style'
      if (!styleMap.has(styleName)) styleMap.set(styleName, [])
      styleMap.get(styleName)!.push(group)
    }
    return [...styleMap.entries()].map(([styleName, styleGroups]) => ({
      styleName,
      groups: styleGroups,
      totalLayers: styleGroups.reduce((s, g) => s + g.count, 0),
    })).sort((a, b) => b.totalLayers - a.totalLayers)
  }, [localGroups])

  const totalLayers = localGroups.reduce((s, g) => s + g.count, 0)

  function toggleStyle(name: string) {
    const next = new Set(expandedStyles)
    if (next.has(name)) next.delete(name); else next.add(name)
    setExpandedStyles(next)
  }

  if (!result) return <div className="flex items-center justify-center h-full"><p className="text-xs text-ink-disabled">No scan data.</p></div>

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-5 py-3 border-b border-border-subtle bg-surface-1">
        <p className="text-base font-semibold text-ink">Local Styles</p>
        <p className="text-xs text-ink-3 mt-0.5">{totalLayers.toLocaleString()} layers · {localGroups.length} signatures · {styles.length} style{styles.length !== 1 ? 's' : ''}</p>
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
            <button onClick={() => toggleStyle(style.styleName)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left">
              <ChevronRight className={cn('w-3.5 h-3.5 text-ink-3 shrink-0 transition-transform', expandedStyles.has(style.styleName) && 'rotate-90')} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{style.styleName}</p>
                <p className="text-2xs text-ink-3">{style.groups.length} signature{style.groups.length !== 1 ? 's' : ''} · {style.totalLayers.toLocaleString()} layers</p>
              </div>
            </button>
            {expandedStyles.has(style.styleName) && style.groups.map(group => (
              <div key={group.id} className="flex items-center gap-3 pl-10 pr-4 py-2 bg-surface-0 border-t border-border-subtle/50 text-xs">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink truncate">{group.descriptor.fontFamily} {group.descriptor.fontStyle} / {group.descriptor.fontSize}px</p>
                  <p className="text-ink-3">{group.count.toLocaleString()} layers</p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
