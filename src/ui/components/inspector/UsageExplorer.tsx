import { useState } from 'react'
import { ChevronRight, MousePointerClick, Navigation } from 'lucide-react'
import { cn } from '../../lib/cn'
import { sendToPlugin } from '../../hooks/useSendMessage'
import { useUIStore } from '../../store/ui'
import { locationFromItem } from '../../../shared/navigation'
import type { AuditItem } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'

interface PageGroup {
  pageId: string
  pageName: string
  frames: FrameGroup[]
  totalLayers: number
}

interface FrameGroup {
  frameName: string
  items: AuditItem<TypographyProperties>[]
}

function buildPageGroups(items: AuditItem<TypographyProperties>[]): PageGroup[] {
  const pageMap = new Map<string, { pageName: string; frameMap: Map<string, AuditItem<TypographyProperties>[]> }>()

  for (const item of items) {
    if (!pageMap.has(item.pageId)) {
      pageMap.set(item.pageId, { pageName: item.pageName, frameMap: new Map() })
    }
    const page = pageMap.get(item.pageId)!
    const frameName = item.parentName ?? '(root)'
    if (!page.frameMap.has(frameName)) page.frameMap.set(frameName, [])
    page.frameMap.get(frameName)!.push(item)
  }

  return [...pageMap.entries()].map(([pageId, { pageName, frameMap }]) => ({
    pageId,
    pageName,
    totalLayers: [...frameMap.values()].reduce((s, arr) => s + arr.length, 0),
    frames: [...frameMap.entries()].map(([frameName, frameItems]) => ({ frameName, items: frameItems })),
  })).sort((a, b) => b.totalLayers - a.totalLayers)
}

interface UsageExplorerProps {
  items: AuditItem<TypographyProperties>[]
  onClose: () => void
}

/**
 * Usage Explorer — replaces cross-page native selection.
 *
 * Groups layers by Page → Frame → Layer.
 * “Select on this page” uses native Figma selection (current page only, no freeze).
 * “Navigate to layer” does single-layer cross-page navigation (works fine).
 * Never calls SELECT_NODES with layers from multiple pages.
 */
export function UsageExplorer({ items, onClose }: UsageExplorerProps) {
  const { currentPageId } = useUIStore()
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set())
  const [expandedFrames, setExpandedFrames] = useState<Set<string>>(new Set())

  const pageGroups = buildPageGroups(items)

  function togglePage(id: string) {
    const next = new Set(expandedPages)
    if (next.has(id)) next.delete(id); else next.add(id)
    setExpandedPages(next)
  }

  function toggleFrame(key: string) {
    const next = new Set(expandedFrames)
    if (next.has(key)) next.delete(key); else next.add(key)
    setExpandedFrames(next)
  }

  function selectOnCurrentPage(pageId: string, pageItems: AuditItem<TypographyProperties>[]) {
    const locations = pageItems.map(locationFromItem)
    // All on one page — plugin will use native selection
    sendToPlugin({ type: 'SELECT_NODES', payload: { locations } })
  }

  function navigateToLayer(item: AuditItem<TypographyProperties>) {
    sendToPlugin({ type: 'SELECT_NODES', payload: { locations: [locationFromItem(item)] } })
  }

  return (
    <div className="border-t border-border flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle shrink-0">
        <Navigation className="w-3.5 h-3.5 text-ink-3" />
        <span className="text-xs font-semibold text-ink flex-1">Usage Explorer</span>
        <span className="text-2xs text-ink-3">{items.length.toLocaleString()} layers across {pageGroups.length} page{pageGroups.length !== 1 ? 's' : ''}</span>
        <button onClick={onClose} className="text-2xs text-ink-disabled hover:text-ink-3 transition-colors">Close</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {pageGroups.map(pg => {
          const isCurrentPage = pg.pageId === currentPageId
          const isExpanded = expandedPages.has(pg.pageId)
          const allItems = pg.frames.flatMap(f => f.items)

          return (
            <div key={pg.pageId} className="border-b border-border-subtle">
              {/* Page row */}
              <div className="flex items-center gap-2 px-3 py-2 hover:bg-surface-hover transition-colors">
                <button onClick={() => togglePage(pg.pageId)} className="flex items-center gap-1.5 flex-1 text-left min-w-0">
                  <ChevronRight className={cn('w-3 h-3 text-ink-3 shrink-0 transition-transform', isExpanded && 'rotate-90')} />
                  <span className="text-xs font-medium text-ink truncate">{pg.pageName}</span>
                  {isCurrentPage && <span className="text-2xs text-accent shrink-0">(current)</span>}
                  <span className="text-2xs text-ink-3 ml-auto shrink-0">{pg.totalLayers.toLocaleString()}</span>
                </button>
                {isCurrentPage && (
                  <button
                    onClick={() => selectOnCurrentPage(pg.pageId, allItems)}
                    className="shrink-0 text-2xs font-medium text-accent hover:text-accent-hover transition-colors"
                    title="Select all layers on this page"
                  >
                    Select all
                  </button>
                )}
              </div>

              {/* Frame groups */}
              {isExpanded && pg.frames.map(fg => {
                const frameKey = `${pg.pageId}::${fg.frameName}`
                const frameExpanded = expandedFrames.has(frameKey)
                return (
                  <div key={fg.frameName} className="pl-4">
                    <button
                      onClick={() => toggleFrame(frameKey)}
                      className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-surface-hover transition-colors text-left"
                    >
                      <ChevronRight className={cn('w-3 h-3 text-ink-3 shrink-0 transition-transform', frameExpanded && 'rotate-90')} />
                      <span className="text-xs text-ink-2 truncate flex-1">{fg.frameName}</span>
                      <span className="text-2xs text-ink-3 shrink-0">{fg.items.length}</span>
                    </button>

                    {frameExpanded && fg.items.map(item => (
                      <div key={item.id} className="flex items-center gap-2 pl-10 pr-3 py-1 hover:bg-surface-hover transition-colors">
                        <span className="text-2xs text-ink truncate flex-1">{item.nodeName}</span>
                        <button
                          onClick={() => navigateToLayer(item)}
                          className="shrink-0 p-0.5 rounded text-ink-3 hover:text-accent transition-colors"
                          title="Navigate to this layer"
                        >
                          <MousePointerClick className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
