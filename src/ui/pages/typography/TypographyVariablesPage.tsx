import { useMemo, useState } from 'react'
import { ChevronRight, ChevronDown, Braces, Loader2 } from 'lucide-react'
import { useAuditStore } from '../../store/audit'
import { usePlanningDataStore } from '../../store/planningData'
import { cn } from '../../lib/cn'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'
import type { AvailableTypographyVariable } from '../../../shared/migration'

// ---------------------------------------------------------------------------
// Type badge
// ---------------------------------------------------------------------------

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  FLOAT:   { label: 'Number',  cls: 'bg-accent-subtle text-accent border-accent/20' },
  STRING:  { label: 'String',  cls: 'bg-success-subtle text-success border-success/20' },
  COLOR:   { label: 'Color',   cls: 'bg-warning-subtle text-warning border-warning/20' },
  BOOLEAN: { label: 'Boolean', cls: 'bg-surface-active text-ink-3 border-border' },
}

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_BADGE[type] ?? { label: type, cls: 'bg-surface-0 text-ink-3 border-border' }
  return (
    <span className={cn('text-2xs px-1.5 py-0.5 rounded font-medium border', cfg.cls)}>
      {cfg.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Variable row
// ---------------------------------------------------------------------------

function VariableRow({
  variable, usageGroups,
}: {
  variable: AvailableTypographyVariable
  usageGroups: AuditGroup<TypographyProperties>[]
}) {
  const [open, setOpen] = useState(false)
  const totalLayers = usageGroups.reduce((s, g) => s + g.count, 0)

  return (
    <div className="border-b border-border-subtle last:border-b-0">
      <button
        onClick={() => usageGroups.length > 0 && setOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left',
          usageGroups.length > 0 ? 'hover:bg-surface-hover cursor-pointer' : 'cursor-default'
        )}
      >
        {usageGroups.length > 0 ? (
          open
            ? <ChevronDown  className="w-3 h-3 text-ink-3 shrink-0" />
            : <ChevronRight className="w-3 h-3 text-ink-3 shrink-0" />
        ) : (
          <span className="w-3 h-3 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-ink truncate">{variable.name}</p>
          {totalLayers > 0 && (
            <p className="text-2xs text-ink-3">
              {totalLayers.toLocaleString()} layer{totalLayers !== 1 ? 's' : ''} bound
            </p>
          )}
        </div>
        <TypeBadge type={variable.resolvedType} />
      </button>

      {open && usageGroups.map(g => {
        const p = g.descriptor
        return (
          <div key={g.key} className="flex items-start gap-3 pl-10 pr-4 py-2 border-t border-border-subtle/50 bg-surface-0">
            <div className="w-1 h-1 rounded-full bg-border-strong shrink-0 mt-1.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-ink">{p.fontFamily} {p.fontStyle}</p>
              <p className="text-2xs text-ink-3">{p.fontSize}px</p>
            </div>
            <span className="text-xs tabular-nums text-ink-2 shrink-0">
              {g.count.toLocaleString()}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Collection group
// ---------------------------------------------------------------------------

function CollectionGroup({
  collectionName, variables, variableGroups,
}: {
  collectionName: string
  variables: AvailableTypographyVariable[]
  variableGroups: AuditGroup<TypographyProperties>[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-border-subtle last:border-b-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-surface-hover transition-colors sticky top-0 bg-surface-0 border-b border-border-subtle z-10 text-left"
      >
        {open
          ? <ChevronDown  className="w-3.5 h-3.5 text-ink-3 shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-ink-3 shrink-0" />
        }
        <span className="text-xs font-semibold text-ink-2 flex-1">{collectionName}</span>
        <span className="text-2xs text-ink-disabled">{variables.length}</span>
      </button>

      {open && variables.map(v => {
        const usage = variableGroups.filter(g => {
          const src = (g.descriptor as TypographyProperties).source
          return src?.type === 'Variable' && src.variableId === v.id
        })
        return <VariableRow key={v.id} variable={v} usageGroups={usage} />
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function TypographyVariablesPage() {
  const { result }   = useAuditStore()
  const { variables, loaded, loading } = usePlanningDataStore()

  // All scan groups (for cross-referencing usage)
  const allGroups = useMemo(() =>
    (result?.groups ?? []) as unknown as AuditGroup<TypographyProperties>[],
    [result]
  )
  const variableGroups = useMemo(() =>
    allGroups.filter(g => g.source === 'Variable'),
    [allGroups]
  )

  // Group variables by collection
  const collections = useMemo(() => {
    const map = new Map<string, AvailableTypographyVariable[]>()
    for (const v of variables) {
      if (!map.has(v.collectionName)) map.set(v.collectionName, [])
      map.get(v.collectionName)!.push(v)
    }
    return [...map.entries()]
      .map(([name, vars]) => ({ name, vars }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [variables])

  const totalVars = variables.length
  const totalCollections = collections.length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-surface-0">
        <Braces className="w-3.5 h-3.5 text-ink-disabled" />
        <span className="text-xs text-ink-3 flex-1">
          {loading ? 'Loading…' : `${totalVars} variable${totalVars !== 1 ? 's' : ''} in ${totalCollections} collection${totalCollections !== 1 ? 's' : ''}`}
        </span>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-3" />}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-xs text-ink-3">
            <Loader2 className="w-4 h-4 animate-spin" />Loading variables…
          </div>
        ) : !result && !loaded ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <p className="text-sm font-medium text-ink mb-1">No scan data</p>
            <p className="text-xs text-ink-3">Run a scan first to discover variables.</p>
          </div>
        ) : collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-8 text-center">
            <Braces className="w-8 h-8 text-ink-disabled" strokeWidth={1.5} />
            <p className="text-sm font-medium text-ink">No variables found</p>
            <p className="text-xs text-ink-3 leading-relaxed max-w-xs">
              No local variable collections exist in this file.
            </p>
          </div>
        ) : (
          collections.map(({ name, vars }) => (
            <CollectionGroup
              key={name}
              collectionName={name}
              variables={vars}
              variableGroups={variableGroups}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {!loading && variableGroups.length > 0 && (
        <div className="shrink-0 border-t border-border-subtle bg-surface-1 px-3 py-2">
          <p className="text-2xs text-ink-3">
            {variableGroups.length} signature{variableGroups.length !== 1 ? 's' : ''} bound to variables in this scan
          </p>
        </div>
      )}
    </div>
  )
}
