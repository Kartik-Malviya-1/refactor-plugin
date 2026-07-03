import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useAuditStore } from '../../store/audit'
import { usePlanningDataStore } from '../../store/planningData'
import { cn } from '../../lib/cn'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'

export function LibraryStylesPage() {
  const { result } = useAuditStore()
  const { textStyles } = usePlanningDataStore()
  const [expandedLibs, setExpandedLibs] = useState<Set<string>>(new Set())

  const groups = useMemo(() =>
    (result?.groups ?? []) as unknown as AuditGroup<TypographyProperties>[],
    [result]
  )
  const libraryGroups = useMemo(() => groups.filter(g => g.source === 'Library Text Style'), [groups])
  const libraryStyles = useMemo(() => textStyles.filter(s => !s.isLocal), [textStyles])

  // Group styles by library name
  const libraries = useMemo(() => {
    const map = new Map<string, typeof textStyles>()
    for (const style of libraryStyles) {
      const lib = style.libraryName ?? 'Unknown Library'
      const arr = map.get(lib) ?? []
      arr.push(style)
      map.set(lib, arr)
    }
    return [...map.entries()].map(([name, styles]) => ({
      name,
      styles,
      layerCount: styles.reduce((s, style) => {
        // Find audit groups that match this style
        return s + libraryGroups
          .filter(g => g.items.some(item => (item as Record<string, unknown>).textStyleId === style.id))
          .reduce((a, g) => a + g.count, 0)
      }, 0),
    }))
  }, [libraryStyles, libraryGroups])

  const totalLayers = libraryGroups.reduce((s, g) => s + g.count, 0)

  function toggleLib(name: string) {
    const next = new Set(expandedLibs)
    if (next.has(name)) next.delete(name); else next.add(name)
    setExpandedLibs(next)
  }

  if (!result) {
    return <div className="flex items-center justify-center h-full"><p className="text-xs text-ink-disabled">No scan data. Run a scan first.</p></div>
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-5 py-3 border-b border-border-subtle bg-surface-1">
        <p className="text-base font-semibold text-ink">Library Styles</p>
        <p className="text-xs text-ink-3 mt-0.5">
          {totalLayers.toLocaleString()} layers · {libraryGroups.length} signatures · {libraries.length} librar{libraries.length !== 1 ? 'ies' : 'y'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {libraries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-8 text-center">
            <p className="text-sm font-medium text-ink">No library styles detected</p>
            <p className="text-xs text-ink-3 leading-relaxed max-w-xs">
              Library styles appear here when text layers in this file use styles from external Figma libraries.
            </p>
          </div>
        ) : libraries.map(lib => (
          <div key={lib.name} className="border-b border-border-subtle">
            {/* Library header */}
            <button
              onClick={() => toggleLib(lib.name)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left"
            >
              <ChevronRight className={cn('w-3.5 h-3.5 text-ink-3 shrink-0 transition-transform', expandedLibs.has(lib.name) && 'rotate-90')} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{lib.name}</p>
                <p className="text-2xs text-ink-3">{lib.styles.length} style{lib.styles.length !== 1 ? 's' : ''}</p>
              </div>
              {lib.layerCount > 0 && <span className="text-xs tabular-nums text-ink-2 shrink-0">{lib.layerCount.toLocaleString()} layers</span>}
            </button>

            {/* Style list */}
            {expandedLibs.has(lib.name) && (
              <div className="bg-surface-0">
                {lib.styles.map(style => (
                  <div key={style.id} className="flex items-center gap-3 px-8 py-2 border-t border-border-subtle text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ink truncate">{style.name}</p>
                      <p className="text-ink-3">{style.fontFamily} {style.fontStyle} / {style.fontSize}px</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Unmatched library groups */}
        {libraryGroups.length > 0 && (
          <div className="px-5 py-4 border-t border-border-subtle">
            <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Typography Signatures using Library Styles</p>
            <p className="text-xs text-ink-3">
              {libraryGroups.length} signature{libraryGroups.length !== 1 ? 's' : ''} across {totalLayers.toLocaleString()} layers are bound to library text styles.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
