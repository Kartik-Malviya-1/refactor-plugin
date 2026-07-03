import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useAuditStore } from '../../store/audit'
import { cn } from '../../lib/cn'
import { formatLineHeight } from '../../../modules/typography/normalizer'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'

function SignatureDetail({ group }: { group: AuditGroup<TypographyProperties> }) {
  const p  = group.descriptor
  const lh = formatLineHeight(p.lineHeight)
  return (
    <div className="flex items-start gap-3 pl-12 pr-4 py-2 border-t border-border-subtle/50 bg-surface-0">
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

interface VariableEntry {
  varName: string
  groups: AuditGroup<TypographyProperties>[]
  totalLayers: number
}

interface CollectionEntry {
  collName: string
  variables: VariableEntry[]
  totalLayers: number
}

export function TypographyVariablesPage() {
  const { result } = useAuditStore()
  const [expandedColls, setExpandedColls] = useState<Set<string>>(new Set())
  const [expandedVars,  setExpandedVars]  = useState<Set<string>>(new Set())

  const groups = useMemo(() =>
    (result?.groups ?? []) as unknown as AuditGroup<TypographyProperties>[],
    [result]
  )

  const variableGroups = useMemo(() =>
    groups.filter(g => g.source === 'Variable'),
    [groups]
  )

  // Group by collection → variable name.
  // Never display variableId (internal identifier) in the primary UI.
  const collections = useMemo((): CollectionEntry[] => {
    const collMap = new Map<string, Map<string, AuditGroup<TypographyProperties>[]>>()

    for (const group of variableGroups) {
      const src        = group.descriptor.source
      const collection = src?.variableCollection ?? 'Unknown Collection'
      // Human-readable variable name only
      const varName    = src?.variableName ?? 'Unnamed Variable'

      if (!collMap.has(collection)) collMap.set(collection, new Map())
      const varMap = collMap.get(collection)!
      if (!varMap.has(varName)) varMap.set(varName, [])
      varMap.get(varName)!.push(group)
    }

    return [...collMap.entries()]
      .map(([collName, varMap]): CollectionEntry => {
        const variables: VariableEntry[] = [...varMap.entries()]
          .map(([varName, varGroups]) => ({
            varName,
            groups:      varGroups,
            totalLayers: varGroups.reduce((s, g) => s + g.count, 0),
          }))
          .sort((a, b) => b.totalLayers - a.totalLayers)

        return {
          collName,
          variables,
          totalLayers: variables.reduce((s, v) => s + v.totalLayers, 0),
        }
      })
      .sort((a, b) => b.totalLayers - a.totalLayers)
  }, [variableGroups])

  const totalLayers = variableGroups.reduce((s, g) => s + g.count, 0)

  function toggleColl(name: string) {
    const next = new Set(expandedColls)
    if (next.has(name)) next.delete(name); else next.add(name)
    setExpandedColls(next)
  }
  function toggleVar(key: string) {
    const next = new Set(expandedVars)
    if (next.has(key)) next.delete(key); else next.add(key)
    setExpandedVars(next)
  }

  if (!result) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-xs text-ink-disabled">No scan data. Run a scan first.</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-5 py-3 border-b border-border-subtle bg-surface-1">
        <p className="text-base font-semibold text-ink">Variables</p>
        <p className="text-xs text-ink-3 mt-0.5">
          {totalLayers.toLocaleString()} layers ·
          {' '}{variableGroups.length} signature{variableGroups.length !== 1 ? 's' : ''} ·
          {' '}{collections.length} collection{collections.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-8 text-center">
            <p className="text-sm font-medium text-ink">No typography variables detected</p>
            <p className="text-xs text-ink-3 leading-relaxed max-w-xs">
              Variables appear when text layers are bound to Figma variables.
            </p>
          </div>
        ) : collections.map(coll => (
          <div key={coll.collName} className="border-b border-border-subtle">
            {/* Collection header */}
            <button
              onClick={() => toggleColl(coll.collName)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left"
            >
              <ChevronRight className={cn(
                'w-3.5 h-3.5 text-ink-3 shrink-0 transition-transform',
                expandedColls.has(coll.collName) && 'rotate-90'
              )} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{coll.collName}</p>
                <p className="text-2xs text-ink-3">
                  {coll.variables.length} variable{coll.variables.length !== 1 ? 's' : ''} ·
                  {' '}{coll.totalLayers.toLocaleString()} layers
                </p>
              </div>
            </button>

            {/* Variables */}
            {expandedColls.has(coll.collName) && coll.variables.map(v => {
              const varKey = `${coll.collName}::${v.varName}`
              const isExpanded = expandedVars.has(varKey)
              return (
                <div key={v.varName} className="border-t border-border-subtle/60">
                  <button
                    onClick={() => toggleVar(varKey)}
                    className="w-full flex items-center gap-3 pl-8 pr-4 py-2.5 hover:bg-surface-hover transition-colors text-left"
                  >
                    <ChevronRight className={cn(
                      'w-3 h-3 text-ink-3 shrink-0 transition-transform',
                      isExpanded && 'rotate-90'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{v.varName}</p>
                      <p className="text-2xs text-ink-3">
                        {v.totalLayers.toLocaleString()} layer{v.totalLayers !== 1 ? 's' : ''} ·
                        {' '}{v.groups.length} signature{v.groups.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </button>

                  {isExpanded && v.groups.map(group => (
                    <SignatureDetail key={group.id} group={group} />
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
