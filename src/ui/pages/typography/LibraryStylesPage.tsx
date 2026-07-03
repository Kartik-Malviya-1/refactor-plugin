import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useAuditStore } from '../../store/audit'
import { cn } from '../../lib/cn'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'

/**
 * Library Styles page — v0.2.1
 *
 * Now reads source information directly from group.descriptor.source,
 * which is populated by the scanner via figma.getStyleById().
 * Groups by libraryName (derived from style name prefix during scan).
 */
export function LibraryStylesPage() {
  const { result } = useAuditStore()
  const [expandedLibs, setExpandedLibs] = useState<Set<string>>(new Set())
  const [expandedStyles, setExpandedStyles] = useState<Set<string>>(new Set())

  const groups = useMemo(() =>
    (result?.groups ?? []) as unknown as AuditGroup<TypographyProperties>[],
    [result]
  )

  // Only library-style groups
  const libraryGroups = useMemo(() =>
    groups.filter(g => g.source === 'Library Text Style'),
    [groups]
  )

  // Group by library name → style name
  const libraries = useMemo(() => {
    const libMap = new Map<string, Map<string, AuditGroup<TypographyProperties>[]>>()

    for (const group of libraryGroups) {
      const src = group.descriptor.source
      const libName = src?.libraryName ?? 'External Library'
      const styleName = src?.styleName ?? group.descriptor.textStyleId ?? 'Unknown Style'

      if (!libMap.has(libName)) libMap.set(libName, new Map())
      const styleMap = libMap.get(libName)!
      if (!styleMap.has(styleName)) styleMap.set(styleName, [])
      styleMap.get(styleName)!.push(group)
    }

    return [...libMap.entries()].map(([libName, styleMap]) => ({
      libName,
      styles: [...styleMap.entries()].map(([styleName, styleGroups]) => ({
        styleName,
        groups: styleGroups,
        totalLayers: styleGroups.reduce((s, g) => s + g.count, 0),
      })).sort((a, b) => b.totalLayers - a.totalLayers),
      totalLayers: [...styleMap.values()].flat().reduce((s, g) => s + g.count, 0),
    })).sort((a, b) => b.totalLayers - a.totalLayers)
  }, [libraryGroups])

  const totalLayers = libraryGroups.reduce((s, g) => s + g.count, 0)

  function toggleLib(name: string) {
    const next = new Set(expandedLibs)
    if (next.has(name)) next.delete(name); else next.add(name)
    setExpandedLibs(next)
  }
  function toggleStyle(key: string) {
    const next = new Set(expandedStyles)
    if (next.has(key)) next.delete(key); else next.add(key)
    setExpandedStyles(next)
  }

  if (!result) return <div className="flex items-center justify-center h-full"><p className="text-xs text-ink-disabled">No scan data.</p></div>

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-5 py-3 border-b border-border-subtle bg-surface-1">
        <p className="text-base font-semibold text-ink">Library Styles</p>
        <p className="text-xs text-ink-3 mt-0.5">{totalLayers.toLocaleString()} layers · {libraryGroups.length} signatures · {libraries.length} librar{libraries.length !== 1 ? 'ies' : 'y'}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {libraries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-8 text-center">
            <p className="text-sm font-medium text-ink">No library styles detected</p>
            <p className="text-xs text-ink-3 leading-relaxed max-w-xs">
              Library styles appear when text layers use styles from external Figma libraries.
              Re-scan this document to detect them.
            </p>
          </div>
        ) : libraries.map(lib => (
          <div key={lib.libName} className="border-b border-border-subtle">
            {/* Library header */}
            <button onClick={() => toggleLib(lib.libName)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left">
              <ChevronRight className={cn('w-3.5 h-3.5 text-ink-3 shrink-0 transition-transform', expandedLibs.has(lib.libName) && 'rotate-90')} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{lib.libName}</p>
                <p className="text-2xs text-ink-3">{lib.styles.length} style{lib.styles.length !== 1 ? 's' : ''} · {lib.totalLayers.toLocaleString()} layers</p>
              </div>
            </button>

            {expandedLibs.has(lib.libName) && lib.styles.map(style => {
              const styleKey = `${lib.libName}::${style.styleName}`
              return (
                <div key={style.styleName} className="pl-4 border-t border-border-subtle/50">
                  <button onClick={() => toggleStyle(styleKey)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-hover transition-colors text-left">
                    <ChevronRight className={cn('w-3 h-3 text-ink-3 shrink-0 transition-transform', expandedStyles.has(styleKey) && 'rotate-90')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-ink truncate">{style.styleName}</p>
                      <p className="text-2xs text-ink-3">{style.groups.length} signature{style.groups.length !== 1 ? 's' : ''} · {style.totalLayers.toLocaleString()} layers</p>
                    </div>
                  </button>

                  {expandedStyles.has(styleKey) && style.groups.map(group => (
                    <div key={group.id} className="flex items-center gap-3 pl-10 pr-4 py-2 bg-surface-0 border-t border-border-subtle/50 text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-ink truncate">{group.descriptor.fontFamily} {group.descriptor.fontStyle} / {group.descriptor.fontSize}px</p>
                        <p className="text-ink-3">{group.count.toLocaleString()} layers</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
