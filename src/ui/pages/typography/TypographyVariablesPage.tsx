import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useAuditStore } from '../../store/audit'
import { cn } from '../../lib/cn'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'

export function TypographyVariablesPage() {
  const { result } = useAuditStore()
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())
  const [expandedVars, setExpandedVars] = useState<Set<string>>(new Set())

  const groups = useMemo(() =>
    (result?.groups ?? []) as unknown as AuditGroup<TypographyProperties>[],
    [result]
  )

  const variableGroups = useMemo(() =>
    groups.filter(g => g.source === 'Variable'),
    [groups]
  )

  // Group by collection → variable name
  const collections = useMemo(() => {
    const collMap = new Map<string, Map<string, AuditGroup<TypographyProperties>[]>>()

    for (const group of variableGroups) {
      const src = group.descriptor.source
      const collection = src?.variableCollection ?? 'Unknown Collection'
      const varName = src?.variableName ?? 'Unknown Variable'

      if (!collMap.has(collection)) collMap.set(collection, new Map())
      const varMap = collMap.get(collection)!
      if (!varMap.has(varName)) varMap.set(varName, [])
      varMap.get(varName)!.push(group)
    }

    return [...collMap.entries()].map(([collName, varMap]) => ({
      collName,
      variables: [...varMap.entries()].map(([varName, varGroups]) => ({
        varName,
        groups: varGroups,
        totalLayers: varGroups.reduce((s, g) => s + g.count, 0),
      })).sort((a, b) => b.totalLayers - a.totalLayers),
      totalLayers: [...varMap.values()].flat().reduce((s, g) => s + g.count, 0),
    })).sort((a, b) => b.totalLayers - a.totalLayers)
  }, [variableGroups])

  const totalLayers = variableGroups.reduce((s, g) => s + g.count, 0)

  function toggleColl(name: string) {
    const next = new Set(expandedCollections)
    if (next.has(name)) next.delete(name); else next.add(name)
    setExpandedCollections(next)
  }
  function toggleVar(key: string) {
    const next = new Set(expandedVars)
    if (next.has(key)) next.delete(key); else next.add(key)
    setExpandedVars(next)
  }

  if (!result) return <div className="flex items-center justify-center h-full"><p className="text-xs text-ink-disabled">No scan data.</p></div>

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-5 py-3 border-b border-border-subtle bg-surface-1">
        <p className="text-base font-semibold text-ink">Variables</p>
        <p className="text-xs text-ink-3 mt-0.5">{totalLayers.toLocaleString()} layers · {variableGroups.length} signatures</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-8 text-center">
            <p className="text-sm font-medium text-ink">No typography variables detected</p>
            <p className="text-xs text-ink-3 leading-relaxed max-w-xs">
              Variables appear when text layers are bound to Figma variables for font family, size, or other properties.
            </p>
          </div>
        ) : collections.map(coll => (
          <div key={coll.collName} className="border-b border-border-subtle">
            <button onClick={() => toggleColl(coll.collName)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left">
              <ChevronRight className={cn('w-3.5 h-3.5 text-ink-3 shrink-0 transition-transform', expandedCollections.has(coll.collName) && 'rotate-90')} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{coll.collName}</p>
                <p className="text-2xs text-ink-3">{coll.variables.length} variable{coll.variables.length !== 1 ? 's' : ''} · {coll.totalLayers.toLocaleString()} layers</p>
              </div>
            </button>

            {expandedCollections.has(coll.collName) && coll.variables.map(v => {
              const varKey = `${coll.collName}::${v.varName}`
              return (
                <div key={v.varName} className="pl-4 border-t border-border-subtle/50">
                  <button onClick={() => toggleVar(varKey)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-hover transition-colors text-left">
                    <ChevronRight className={cn('w-3 h-3 text-ink-3 shrink-0 transition-transform', expandedVars.has(varKey) && 'rotate-90')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-ink truncate">{v.varName}</p>
                      <p className="text-2xs text-ink-3">{v.groups.length} signature{v.groups.length !== 1 ? 's' : ''} · {v.totalLayers.toLocaleString()} layers</p>
                    </div>
                  </button>

                  {expandedVars.has(varKey) && v.groups.map(group => (
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
