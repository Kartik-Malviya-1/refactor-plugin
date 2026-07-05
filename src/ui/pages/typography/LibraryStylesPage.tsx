import { useMemo, useState } from 'react'
import { ChevronRight, ChevronDown, Layers, FileText, ArrowLeft, Type, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { useAuditStore } from '../../store/audit'
import { useAssignmentStore } from '../../store/assignment'
import { usePlanningDataStore } from '../../store/planningData'
import { SearchInput } from '../../components/ui/SearchInput'
import { parseStyleName, groupByFolder } from '../../../shared/style-catalog'
import type { AvailableTextStyle } from '../../../shared/migration'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'
import type { ExistingStyleTarget } from '../../../shared/migration'
import { cn } from '../../lib/cn'

// ---------------------------------------------------------------------------
// Style detail panel (Part 3)
// ---------------------------------------------------------------------------

function StyleDetailPanel({
  style, allGroups, assignments, onBack,
}: {
  style:       AvailableTextStyle
  allGroups:   AuditGroup<TypographyProperties>[]
  assignments: Record<string, import('../../store/assignment').AssignedTarget>
  onBack:      () => void
}) {
  const { folder, displayName } = parseStyleName(style.name)

  // Signatures from the scan that use this style as their source
  const usageGroups = useMemo(() =>
    allGroups.filter(g => {
      const src = (g.descriptor as TypographyProperties).source
      if (!src) return false
      const typeMatch = style.isLocal
        ? src.type === 'LocalStyle'
        : src.type === 'LibraryStyle'
      return typeMatch && src.styleId === style.id
    }),
    [allGroups, style]
  )
  const totalLayers = usageGroups.reduce((s, g) => s + g.count, 0)

  // Signatures that are MAPPED TO this style in the assignment store
  const plannedMappings = useMemo(() =>
    Object.entries(assignments).filter(([, a]) => {
      if (a.target.type !== 'existing-style') return false
      return (a.target as ExistingStyleTarget).styleId === style.id
    }),
    [assignments, style.id]
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Back nav */}
      <div className="shrink-0 px-3 py-2 border-b border-border-subtle flex items-center gap-2">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Library Styles
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Identity */}
        <div>
          {folder && <p className="text-2xs text-ink-3 mb-0.5">{folder}</p>}
          <p className="text-base font-semibold text-ink">{displayName}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              'text-2xs px-1.5 py-0.5 rounded font-medium border',
              style.isLocal
                ? 'bg-accent-subtle text-accent border-accent/20'
                : 'bg-success-subtle text-success border-success/20'
            )}>
              {style.isLocal ? 'Local Style' : 'Library Style'}
            </span>
            {style.libraryName && (
              <span className="text-2xs text-ink-3">{style.libraryName}</span>
            )}
          </div>
        </div>

        {/* Typography properties */}
        <div>
          <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Properties</p>
          <div className="border border-border rounded-lg divide-y divide-border-subtle">
            {[
              { label: 'Font Family', value: style.fontFamily },
              { label: 'Style',       value: style.fontStyle },
              { label: 'Size',        value: `${style.fontSize}px` },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-ink-3">{label}</span>
                <span className="text-xs font-medium text-ink">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Usage from scan */}
        <div>
          <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Usage in Scan</p>
          {usageGroups.length === 0 ? (
            <p className="text-xs text-ink-disabled">Not detected in the last scan scope</p>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-ink-2">
                <Layers className="w-3.5 h-3.5 text-ink-3" />
                {totalLayers.toLocaleString()} layer{totalLayers !== 1 ? 's' : ''} across
                {' '}{usageGroups.length} signature{usageGroups.length !== 1 ? 's' : ''}
              </div>
              {usageGroups.slice(0, 5).map(g => (
                <p key={g.key} className="text-2xs text-ink-3 pl-5">
                  {g.label} · {g.count.toLocaleString()} layers
                </p>
              ))}
              {usageGroups.length > 5 && (
                <p className="text-2xs text-ink-disabled pl-5">+{usageGroups.length - 5} more</p>
              )}
            </div>
          )}
        </div>

        {/* Planned mappings */}
        {plannedMappings.length > 0 && (
          <div>
            <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Planned Mappings</p>
            <div className="space-y-1">
              {plannedMappings.map(([sigKey, a]) => (
                <p key={sigKey} className="text-2xs text-accent">
                  ✓ {a.label}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Style row in folder list
// ---------------------------------------------------------------------------

function StyleRow({ style, onClick }: {
  style:   AvailableTextStyle
  onClick: () => void
}) {
  const { displayName } = parseStyleName(style.name)
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-surface-hover transition-colors text-left"
    >
      <Type className="w-3.5 h-3.5 text-ink-disabled shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-ink truncate">{displayName}</p>
        <p className="text-2xs text-ink-3">
          {style.fontFamily} {style.fontStyle} / {style.fontSize}px
        </p>
      </div>
      <ChevronRight className="w-3 h-3 text-ink-disabled shrink-0" />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Folder accordion
// ---------------------------------------------------------------------------

function FolderGroup({ folder, displayName, styles, onSelectStyle }: {
  folder:        string | null
  displayName:   string
  styles:        AvailableTextStyle[]
  onSelectStyle: (s: AvailableTextStyle) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="border-b border-border-subtle last:border-b-0">
      {/* Folder header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-hover transition-colors sticky top-0 bg-surface-0 border-b border-border-subtle z-10"
      >
        {open
          ? <ChevronDown  className="w-3.5 h-3.5 text-ink-3 shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-ink-3 shrink-0" />
        }
        <span className="text-xs font-semibold text-ink-2 flex-1 text-left">{displayName}</span>
        <span className="text-2xs text-ink-disabled">{styles.length}</span>
      </button>

      {/* Style rows */}
      {open && styles.map(s => (
        <StyleRow key={s.id} style={s} onClick={() => onSelectStyle(s)} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Validation badge (Part 5 inline)
// ---------------------------------------------------------------------------

function CatalogStatusBadge({ total, isLoading }: { total: number; isLoading: boolean }) {
  if (isLoading) return (
    <span className="flex items-center gap-1 text-2xs text-ink-3">
      <Loader2 className="w-3 h-3 animate-spin" />Loading
    </span>
  )
  if (total === 0) return (
    <span className="flex items-center gap-1 text-2xs text-warning">
      <AlertTriangle className="w-3 h-3" />No styles
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-2xs text-success">
      <CheckCircle className="w-3 h-3" />{total} styles
    </span>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function LibraryStylesPage() {
  const { textStyles, loaded, loading } = usePlanningDataStore()
  const { result }      = useAuditStore()
  const { assignments } = useAssignmentStore()

  const [selectedStyle, setSelectedStyle] = useState<AvailableTextStyle | null>(null)
  const [search, setSearch] = useState('')

  const allGroups = useMemo(() =>
    (result?.groups ?? []) as unknown as AuditGroup<TypographyProperties>[],
    [result]
  )

  // The canonical catalog for library styles.
  // After sprint B, this includes ALL library styles from the full document
  // (not just those used in the scan scope).
  const libraryStyles = useMemo(() =>
    textStyles.filter(s => !s.isLocal),
    [textStyles]
  )

  const filteredStyles = useMemo(() => {
    if (!search.trim()) return libraryStyles
    const q = search.toLowerCase()
    return libraryStyles.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.fontFamily.toLowerCase().includes(q)
    )
  }, [libraryStyles, search])

  const folders = useMemo(() => groupByFolder(filteredStyles), [filteredStyles])

  // Style detail view
  if (selectedStyle) {
    return (
      <StyleDetailPanel
        style={selectedStyle}
        allGroups={allGroups}
        assignments={assignments}
        onBack={() => setSelectedStyle(null)}
      />
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar — fixed */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-surface-0">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={`Search ${libraryStyles.length} style${libraryStyles.length !== 1 ? 's' : ''}…`}
          className="flex-1"
        />
        <CatalogStatusBadge total={libraryStyles.length} isLoading={loading} />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-xs text-ink-3">
            <Loader2 className="w-4 h-4 animate-spin" />Loading style catalog…
          </div>
        ) : folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <Type className="w-8 h-8 text-ink-disabled mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm font-medium text-ink mb-1">
              {search.trim()
                ? `No styles match “${search}”`
                : !result
                  ? 'No scan data'
                  : 'No library styles found'
              }
            </p>
            <p className="text-xs text-ink-3 leading-relaxed max-w-xs">
              {search.trim()
                ? 'Try a different search term.'
                : !result
                  ? 'Run a scan first to discover library styles.'
                  : 'No library text styles are used in this document.'
              }
            </p>
          </div>
        ) : (
          // Folder groups — Part 2: first path segment becomes the folder
          folders.map(({ folder, displayName, styles }) => (
            <FolderGroup
              key={folder ?? '__toplevel__'}
              folder={folder}
              displayName={displayName}
              styles={styles}
              onSelectStyle={setSelectedStyle}
            />
          ))
        )}
      </div>

      {/* Stats footer — fixed */}
      {!loading && libraryStyles.length > 0 && (
        <div className="shrink-0 border-t border-border-subtle bg-surface-1 px-3 py-2 flex items-center gap-3">
          <FileText className="w-3.5 h-3.5 text-ink-disabled" />
          <span className="text-2xs text-ink-3">
            {libraryStyles.length} style{libraryStyles.length !== 1 ? 's' : ''}
            {' '}· {folders.filter(f => f.folder !== null).length} folder{folders.filter(f=>f.folder!==null).length!==1?'s':''}
          </span>
          {!result && (
            <span className="text-2xs text-ink-disabled ml-auto">Run a scan for usage data</span>
          )}
        </div>
      )}
    </div>
  )
}
