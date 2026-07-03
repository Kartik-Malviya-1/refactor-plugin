import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useAuditStore } from '../../store/audit'
import { usePlanningDataStore } from '../../store/planningData'
import { cn } from '../../lib/cn'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'

export function LocalStylesPage() {
  const { result } = useAuditStore()
  const { textStyles } = usePlanningDataStore()
  const [expanded, setExpanded] = useState(true)

  const groups = useMemo(() =>
    (result?.groups ?? []) as unknown as AuditGroup<TypographyProperties>[],
    [result]
  )
  const localGroups = useMemo(() => groups.filter(g => g.source === 'Local Text Style'), [groups])
  const localStyles = useMemo(() => textStyles.filter(s => s.isLocal), [textStyles])

  const totalLayers = localGroups.reduce((s, g) => s + g.count, 0)

  if (!result) {
    return <div className="flex items-center justify-center h-full"><p className="text-xs text-ink-disabled">No scan data. Run a scan first.</p></div>
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-5 py-3 border-b border-border-subtle bg-surface-1">
        <p className="text-base font-semibold text-ink">Local Styles</p>
        <p className="text-xs text-ink-3 mt-0.5">
          {totalLayers.toLocaleString()} layers · {localGroups.length} signatures · {localStyles.length} style{localStyles.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {localStyles.length === 0 && localGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-8 text-center">
            <p className="text-sm font-medium text-ink">No local styles detected</p>
            <p className="text-xs text-ink-3 leading-relaxed max-w-xs">
              Local styles appear here when text layers use styles defined in this Figma file.
            </p>
          </div>
        ) : (
          <>
            {/* Local styles section */}
            {localStyles.length > 0 && (
              <div className="border-b border-border-subtle">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left"
                >
                  <ChevronRight className={cn('w-3.5 h-3.5 text-ink-3 shrink-0 transition-transform', expanded && 'rotate-90')} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink">This File</p>
                    <p className="text-2xs text-ink-3">{localStyles.length} local text style{localStyles.length !== 1 ? 's' : ''}</p>
                  </div>
                </button>
                {expanded && (
                  <div className="bg-surface-0">
                    {localStyles.map(style => (
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
            )}

            {/* Usage summary */}
            {localGroups.length > 0 && (
              <div className="px-5 py-4">
                <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Typography Signatures using Local Styles</p>
                <p className="text-xs text-ink-3">
                  {localGroups.length} signature{localGroups.length !== 1 ? 's' : ''} across {totalLayers.toLocaleString()} layers are bound to local text styles.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
