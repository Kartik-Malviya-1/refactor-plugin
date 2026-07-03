import { useMemo, useState } from 'react'
import { ChevronRight, CheckCircle, AlertTriangle } from 'lucide-react'
import { useAuditStore } from '../../store/audit'
import { cn } from '../../lib/cn'
import { formatLineHeight } from '../../../modules/typography/normalizer'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'

// ---------------------------------------------------------------------------
// Health indicator
//
// A style that maps to multiple Typography Signatures has inconsistency —
// different layers use the same named style but with different actual properties.
// This is a meaningful signal for designers.
// ---------------------------------------------------------------------------

type HealthStatus = 'clean' | 'review' | 'fragmented'

function healthStatus(signatureCount: number): HealthStatus {
  if (signatureCount === 1) return 'clean'
  if (signatureCount <= 3)  return 'review'
  return 'fragmented'
}

function HealthBadge({ count }: { count: number }) {
  const status = healthStatus(count)
  if (status === 'clean') {
    return (
      <span className="inline-flex items-center gap-1 text-2xs font-medium text-success">
        <CheckCircle className="w-3 h-3" />Clean
      </span>
    )
  }
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-2xs font-medium',
      status === 'fragmented' ? 'text-danger' : 'text-warning'
    )}>
      <AlertTriangle className="w-3 h-3" />
      {status === 'fragmented' ? 'Fragmented' : 'Needs Review'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Typography Signature row (inside an expanded style)
// ---------------------------------------------------------------------------

function SignatureDetail({ group }: { group: AuditGroup<TypographyProperties> }) {
  const p = group.descriptor
  const lh = formatLineHeight(p.lineHeight)
  return (
    <div className="flex items-start gap-3 pl-8 pr-4 py-2 border-t border-border-subtle/50 bg-surface-0">
      <div className="w-1 h-1 rounded-full bg-border-strong shrink-0 mt-1.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-ink">{p.fontFamily}</p>
        <p className="text-2xs text-ink-3">
          {p.fontStyle} · {p.fontSize}px
          {lh !== 'Auto' && <> / {lh}</>}
        </p>
      </div>
      <span className="text-xs tabular-nums text-ink-2 shrink-0">
        {group.count.toLocaleString()} layer{group.count !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

interface StyleEntry {
  styleName: string
  groups: AuditGroup<TypographyProperties>[]
  totalLayers: number
}

interface LibraryEntry {
  libName: string
  styles: StyleEntry[]
  totalLayers: number
  totalSignatures: number
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function LibraryStylesPage() {
  const { result } = useAuditStore()
  const [expandedLibs,   setExpandedLibs]   = useState<Set<string>>(new Set())
  const [expandedStyles, setExpandedStyles] = useState<Set<string>>(new Set())

  const groups = useMemo(() =>
    (result?.groups ?? []) as unknown as AuditGroup<TypographyProperties>[],
    [result]
  )

  const libraryGroups = useMemo(() =>
    groups.filter(g => g.source === 'Library Text Style'),
    [groups]
  )

  // Group by library name → style name.
  // NEVER use styleId or libraryKey as display values.
  const libraries = useMemo((): LibraryEntry[] => {
    const libMap = new Map<string, Map<string, AuditGroup<TypographyProperties>[]>>()

    for (const group of libraryGroups) {
      const src      = group.descriptor.source
      const libName  = src?.libraryName ?? 'External Library'
      // Human-readable style name only — never internal IDs
      const styleName = src?.styleName ?? 'Unnamed Style'

      if (!libMap.has(libName)) libMap.set(libName, new Map())
      const styleMap = libMap.get(libName)!
      if (!styleMap.has(styleName)) styleMap.set(styleName, [])
      styleMap.get(styleName)!.push(group)
    }

    return [...libMap.entries()]
      .map(([libName, styleMap]): LibraryEntry => {
        const styles: StyleEntry[] = [...styleMap.entries()]
          .map(([styleName, styleGroups]) => ({
            styleName,
            groups:      styleGroups,
            totalLayers: styleGroups.reduce((s, g) => s + g.count, 0),
          }))
          .sort((a, b) => b.totalLayers - a.totalLayers)

        return {
          libName,
          styles,
          totalLayers:     styles.reduce((s, e) => s + e.totalLayers, 0),
          totalSignatures: styles.reduce((s, e) => s + e.groups.length, 0),
        }
      })
      .sort((a, b) => b.totalLayers - a.totalLayers)
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

  if (!result) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-xs text-ink-disabled">No scan data. Run a scan first.</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-5 py-3 border-b border-border-subtle bg-surface-1">
        <p className="text-base font-semibold text-ink">Library Styles</p>
        <p className="text-xs text-ink-3 mt-0.5">
          {totalLayers.toLocaleString()} layers ·
          {' '}{libraryGroups.length} signature{libraryGroups.length !== 1 ? 's' : ''} ·
          {' '}{libraries.length} librar{libraries.length !== 1 ? 'ies' : 'y'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {libraries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-8 text-center">
            <p className="text-sm font-medium text-ink">No library styles detected</p>
            <p className="text-xs text-ink-3 leading-relaxed max-w-xs">
              Library styles appear when text layers use styles from external Figma libraries.
            </p>
          </div>
        ) : libraries.map(lib => (
          <div key={lib.libName} className="border-b border-border-subtle">
            {/* Library header */}
            <button
              onClick={() => toggleLib(lib.libName)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left"
            >
              <ChevronRight className={cn(
                'w-3.5 h-3.5 text-ink-3 shrink-0 transition-transform',
                expandedLibs.has(lib.libName) && 'rotate-90'
              )} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{lib.libName}</p>
                <p className="text-2xs text-ink-3">
                  {lib.styles.length} style{lib.styles.length !== 1 ? 's' : ''} ·
                  {' '}{lib.totalLayers.toLocaleString()} layers
                </p>
              </div>
            </button>

            {/* Styles */}
            {expandedLibs.has(lib.libName) && lib.styles.map(style => {
              const styleKey = `${lib.libName}::${style.styleName}`
              const isStyleExpanded = expandedStyles.has(styleKey)
              return (
                <div key={style.styleName} className="border-t border-border-subtle/60">
                  <button
                    onClick={() => toggleStyle(styleKey)}
                    className="w-full flex items-center gap-3 pl-8 pr-4 py-2.5 hover:bg-surface-hover transition-colors text-left"
                  >
                    <ChevronRight className={cn(
                      'w-3 h-3 text-ink-3 shrink-0 transition-transform',
                      isStyleExpanded && 'rotate-90'
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

                  {/* Signatures within this style */}
                  {isStyleExpanded && style.groups.map(group => (
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
