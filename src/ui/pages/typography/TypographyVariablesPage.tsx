import { useMemo } from 'react'
import { useAuditStore } from '../../store/audit'
import { usePlanningDataStore } from '../../store/planningData'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'

export function TypographyVariablesPage() {
  const { result } = useAuditStore()
  const { variables } = usePlanningDataStore()

  const groups = useMemo(() =>
    (result?.groups ?? []) as unknown as AuditGroup<TypographyProperties>[],
    [result]
  )
  const variableGroups = useMemo(() => groups.filter(g => g.source === 'Variable'), [groups])
  const totalLayers = variableGroups.reduce((s, g) => s + g.count, 0)

  // Group variables by collection
  const collections = useMemo(() => {
    const map = new Map<string, typeof variables>()
    for (const v of variables) {
      const arr = map.get(v.collectionName) ?? []
      arr.push(v)
      map.set(v.collectionName, arr)
    }
    return [...map.entries()].map(([name, vars]) => ({ name, vars }))
  }, [variables])

  if (!result) {
    return <div className="flex items-center justify-center h-full"><p className="text-xs text-ink-disabled">No scan data. Run a scan first.</p></div>
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-5 py-3 border-b border-border-subtle bg-surface-1">
        <p className="text-base font-semibold text-ink">Variables</p>
        <p className="text-xs text-ink-3 mt-0.5">
          {totalLayers.toLocaleString()} layers · {variableGroups.length} signatures · {variables.length} variable{variables.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {variables.length === 0 && variableGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-8 text-center">
            <p className="text-sm font-medium text-ink">No typography variables detected</p>
            <p className="text-xs text-ink-3 leading-relaxed max-w-xs">
              Typography variables appear here when text layers are bound to Figma variables for font family, size, or other properties.
            </p>
          </div>
        ) : (
          <>
            {/* Variable collections */}
            {collections.length > 0 && (
              <div className="px-5 py-4 border-b border-border-subtle">
                <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-3">Collections</p>
                {collections.map(col => (
                  <div key={col.name} className="mb-3">
                    <p className="text-xs font-medium text-ink mb-1.5">{col.name}</p>
                    <div className="space-y-0.5">
                      {col.vars.map(v => (
                        <div key={v.id} className="flex items-center gap-3 px-2 py-1.5 bg-surface-0 rounded text-xs">
                          <span className="flex-1 text-ink truncate">{v.name}</span>
                          <span className="text-2xs text-ink-3 shrink-0">{v.resolvedType}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Usage */}
            {variableGroups.length > 0 && (
              <div className="px-5 py-4">
                <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Typography Signatures using Variables</p>
                <p className="text-xs text-ink-3">
                  {variableGroups.length} signature{variableGroups.length !== 1 ? 's' : ''} across {totalLayers.toLocaleString()} layers are bound to typography variables.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
