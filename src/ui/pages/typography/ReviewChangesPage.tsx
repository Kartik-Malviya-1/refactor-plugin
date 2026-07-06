import { useMemo, useEffect, useState, useRef, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, ArrowLeft, Lock,
  CheckCircle, AlertTriangle, SkipForward, Target, Loader2,
  LayoutPanelLeft, Layers, Eye,
} from 'lucide-react'
import { useAuditStore }      from '../../store/audit'
import { useAssignmentStore } from '../../store/assignment'
import { useUIStore }         from '../../store/ui'
import { useReviewStore }     from '../../store/reviewStore'
import { usePreviewStore }    from '../../store/previewStore'
import { buildReviewItems, groupItemsByPage } from '../../lib/review-engine'
import { sendToPlugin } from '../../hooks/useSendMessage'
import type { ReviewItem, ReviewStatus } from '../../../shared/review'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'
import type { LayerMutation } from '../../../shared/messages'
import type { ExistingStyleTarget, NewStyleTarget, ManualValuesTarget } from '../../../shared/migration'
import { cn } from '../../lib/cn'

// ---------------------------------------------------------------------------
// Build LayerMutation[] from a ReviewItem’s changes
// ---------------------------------------------------------------------------

function buildMutations(item: ReviewItem): LayerMutation[] {
  return item.changes.map(c => {
    const t = c.planned.target
    if (t.type === 'existing-style') {
      const tt = t as ExistingStyleTarget
      return { layerId: c.layerId, targetType: 'existing-style', styleId: tt.styleId, fontFamily: tt.fontFamily, fontStyle: tt.fontStyle, fontSize: tt.fontSize }
    }
    if (t.type === 'new-style') {
      const tt = t as NewStyleTarget
      return { layerId: c.layerId, targetType: 'new-style', fontFamily: tt.fontFamily, fontStyle: tt.fontStyle, fontSize: tt.fontSize, lineHeightUnit: tt.lineHeightUnit, lineHeightValue: tt.lineHeightValue, letterSpacingUnit: tt.letterSpacingUnit, letterSpacingValue: tt.letterSpacingValue }
    }
    if (t.type === 'manual-values') {
      const tt = t as ManualValuesTarget
      return { layerId: c.layerId, targetType: 'manual-values', fontFamily: tt.fontFamily, fontStyle: tt.fontStyle, fontSize: tt.fontSize, lineHeightUnit: tt.lineHeightUnit, lineHeightValue: tt.lineHeightValue, letterSpacingUnit: tt.letterSpacingUnit, letterSpacingValue: tt.letterSpacingValue }
    }
    return { layerId: c.layerId, targetType: t.type }
  })
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS: Record<ReviewStatus, { label: string; cls: string }> = {
  unread:            { label: 'Unread',          cls: 'bg-surface-active text-ink-3' },
  reviewed:          { label: 'Reviewed',        cls: 'bg-success-subtle text-success' },
  'needs-attention': { label: 'Needs Attention', cls: 'bg-warning-subtle text-warning' },
  skipped:           { label: 'Skipped',         cls: 'bg-surface-0 text-ink-disabled' },
  accepted:          { label: 'Accepted',        cls: 'bg-accent-subtle text-accent' },
}

type ViewMode = 'side' | 'overlay' | 'diff'

// ---------------------------------------------------------------------------
// Difference view (canvas-based pixel diff)
// ---------------------------------------------------------------------------

function DiffView({ before, after }: { before: string; after: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const loadImg = (src: string): Promise<HTMLImageElement> =>
      new Promise((res, rej) => {
        const img = new Image()
        img.onload = () => res(img)
        img.onerror = rej
        img.src = src
      })

    Promise.all([loadImg(before), loadImg(after)]).then(([bImg, aImg]) => {
      canvas.width  = bImg.width
      canvas.height = bImg.height

      ctx.drawImage(bImg, 0, 0)
      const bPx = ctx.getImageData(0, 0, canvas.width, canvas.height)

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(aImg, 0, 0)
      const aPx = ctx.getImageData(0, 0, canvas.width, canvas.height)

      const diff = new Uint8ClampedArray(bPx.data.length)
      for (let i = 0; i < bPx.data.length; i += 4) {
        const dr = Math.abs(bPx.data[i]   - aPx.data[i])
        const dg = Math.abs(bPx.data[i+1] - aPx.data[i+1])
        const db = Math.abs(bPx.data[i+2] - aPx.data[i+2])
        const changed = (dr + dg + db) > 20
        if (changed) {
          // Purple highlight for changed pixels
          diff[i] = 147; diff[i+1] = 51; diff[i+2] = 234; diff[i+3] = 230
        } else {
          // Dim unchanged pixels
          diff[i] = bPx.data[i] * 0.25; diff[i+1] = bPx.data[i+1] * 0.25
          diff[i+2] = bPx.data[i+2] * 0.25; diff[i+3] = 160
        }
      }
      ctx.putImageData(new ImageData(diff, canvas.width, canvas.height), 0, 0)
    }).catch(() => {})
  }, [before, after])

  return <canvas ref={canvasRef} className="w-full h-full object-contain" style={{ maxHeight: '100%' }} />
}

// ---------------------------------------------------------------------------
// Overlay slider view
// ---------------------------------------------------------------------------

function OverlayView({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50)
  return (
    <div className="relative w-full h-full select-none">
      {/* Before (full width, background) */}
      <img src={before} className="absolute inset-0 w-full h-full object-contain" alt="Before" />
      {/* After (clipped by slider) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <img src={after} className="w-full h-full object-contain" alt="After" />
      </div>
      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md"
        style={{ left: `${pos}%` }}
      />
      {/* Labels */}
      <span className="absolute top-2 left-2 text-2xs font-semibold text-white bg-black/50 px-1.5 py-0.5 rounded">Before</span>
      <span className="absolute top-2 right-2 text-2xs font-semibold text-white bg-black/50 px-1.5 py-0.5 rounded">After</span>
      {/* Slider */}
      <input
        type="range" min={0} max={100} value={pos}
        onChange={e => setPos(Number(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-col-resize"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Preview panel
// ---------------------------------------------------------------------------

function PreviewPanel({
  itemId, viewMode, onRetry,
}: {
  itemId:   string
  viewMode: ViewMode
  onRetry:  () => void
}) {
  const entry = usePreviewStore(s => s.previews[itemId])

  if (!entry || entry.status === 'idle') return null

  if (entry.status === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-1">
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin text-ink-3 mx-auto mb-2" />
          <p className="text-xs text-ink-3">Generating preview…</p>
          <p className="text-2xs text-ink-disabled mt-1">Cloning frame, applying typography</p>
        </div>
      </div>
    )
  }

  if (entry.status === 'error') {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-1">
        <div className="text-center">
          <AlertTriangle className="w-5 h-5 text-warning mx-auto mb-2" />
          <p className="text-xs text-ink-2">Preview failed</p>
          <p className="text-2xs text-ink-3 mt-0.5">{entry.error}</p>
          <button onClick={onRetry} className="mt-2 text-2xs text-accent hover:underline">Retry</button>
        </div>
      </div>
    )
  }

  // status === 'ready'
  const { before, after } = entry

  if (viewMode === 'overlay') {
    return (
      <div className="flex-1 overflow-hidden bg-surface-1">
        <OverlayView before={before} after={after} />
      </div>
    )
  }

  if (viewMode === 'diff') {
    return (
      <div className="flex-1 overflow-hidden bg-surface-1 flex items-center justify-center">
        <DiffView before={before} after={after} />
      </div>
    )
  }

  // side-by-side
  return (
    <div className="flex-1 grid grid-cols-2 divide-x divide-border overflow-hidden bg-surface-1">
      <div className="flex flex-col overflow-hidden">
        <p className="shrink-0 text-2xs font-semibold text-ink-disabled text-center py-1 border-b border-border-subtle bg-surface-0">Before</p>
        <div className="flex-1 overflow-hidden flex items-center justify-center bg-[#f0f0f0]">
          <img src={before} className="max-w-full max-h-full object-contain" alt="Before" />
        </div>
      </div>
      <div className="flex flex-col overflow-hidden">
        <p className="shrink-0 text-2xs font-semibold text-ink-disabled text-center py-1 border-b border-border-subtle bg-surface-0">After</p>
        <div className="flex-1 overflow-hidden flex items-center justify-center bg-[#f0f0f0]">
          <img src={after} className="max-w-full max-h-full object-contain" alt="After" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail view (visual review of one screen)
// ---------------------------------------------------------------------------

function DetailView({
  item, status, index, total, prev, next,
  onBack, onNavigate, onMarkStatus,
}: {
  item:         ReviewItem
  status:       ReviewStatus
  index:        number
  total:        number
  prev:         ReviewItem | null
  next:         ReviewItem | null
  onBack:       () => void
  onNavigate:   (id: string) => void
  onMarkStatus: (s: ReviewStatus) => void
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('side')
  const { setLoading } = usePreviewStore()
  const entry = usePreviewStore(s => s.previews[item.id])

  const requestPreview = useCallback(() => {
    setLoading(item.id)
    const mutations = buildMutations(item)
    const layerIds  = [...new Set(item.changes.map(c => c.layerId))]
    sendToPlugin({ type: 'GENERATE_PREVIEW', payload: { itemId: item.id, pageId: item.pageId, layerIds, mutations } })
  }, [item, setLoading])

  // Request preview on mount if not cached
  useEffect(() => {
    if (!entry || entry.status === 'idle') requestPreview()
  }, [item.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const cfg = STATUS[status]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top navigation */}
      <div className="shrink-0 border-b border-border bg-surface-1">
        <div className="flex items-center gap-2 px-3 py-2">
          <button onClick={onBack}
            className="flex items-center gap-1 text-xs text-ink-3 hover:text-ink transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />All Screens
          </button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-xs font-semibold text-ink truncate">{item.frameName}</p>
            <p className="text-2xs text-ink-3">{item.pageName}</p>
          </div>
          <span className="text-2xs text-ink-disabled">{index + 1} / {total}</span>
        </div>

        {/* View mode + prev/next */}
        <div className="flex items-center border-t border-border-subtle">
          <button disabled={!prev} onClick={() => prev && onNavigate(prev.id)}
            className="flex items-center gap-1 px-3 py-1.5 text-2xs text-ink-3 hover:text-ink hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-r border-border-subtle">
            <ChevronLeft className="w-3.5 h-3.5" />{prev?.frameName ?? 'First'}
          </button>

          <div className="flex flex-1 items-center justify-center gap-0.5 px-2">
            {([
              { id: 'side',    label: 'Side',    icon: LayoutPanelLeft },
              { id: 'overlay', label: 'Overlay', icon: Layers },
              { id: 'diff',    label: 'Diff',    icon: Eye },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setViewMode(id)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded text-2xs transition-colors',
                  viewMode === id
                    ? 'bg-accent-subtle text-accent font-medium'
                    : 'text-ink-3 hover:text-ink hover:bg-surface-hover'
                )}>
                <Icon className="w-3 h-3" />{label}
              </button>
            ))}
          </div>

          <button disabled={!next} onClick={() => next && onNavigate(next.id)}
            className="flex items-center gap-1 px-3 py-1.5 text-2xs text-ink-3 hover:text-ink hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-l border-border-subtle">
            {next?.frameName ?? 'Last'}<ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Preview area */}
      <PreviewPanel
        itemId={item.id}
        viewMode={viewMode}
        onRetry={requestPreview}
      />

      {/* Status + navigation footer */}
      <div className="shrink-0 border-t border-border bg-surface-1 px-3 py-2 flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          {([
            { s: 'reviewed'        as ReviewStatus, icon: CheckCircle,   label: 'Reviewed' },
            { s: 'needs-attention' as ReviewStatus, icon: AlertTriangle, label: 'Flag' },
            { s: 'skipped'         as ReviewStatus, icon: SkipForward,   label: 'Skip' },
          ]).map(({ s, icon: Icon, label }) => (
            <button key={s} onClick={() => onMarkStatus(s)}
              className={cn(
                'flex items-center gap-1 px-2 py-1.5 rounded text-2xs font-medium transition-colors border',
                status === s
                  ? STATUS[s].cls + ' border-current/30'
                  : 'bg-surface-0 border-border text-ink-2 hover:border-border-strong'
              )}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          {cfg && (
            <span className={cn('text-2xs px-1.5 py-0.5 rounded font-medium', cfg.cls)}>{cfg.label}</span>
          )}
          <button disabled={!prev} onClick={() => prev && onNavigate(prev.id)}
            className="p-1 rounded text-ink-3 hover:text-ink hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button disabled={!next} onClick={() => next && onNavigate(next.id)}
            className="p-1 rounded text-ink-3 hover:text-ink hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// List view (screen index)
// ---------------------------------------------------------------------------

function ListView({
  pageGroups, statuses, visitedCount, total, isReady, onSelectItem,
}: {
  pageGroups:   ReturnType<typeof groupItemsByPage>
  statuses:     Record<string, ReviewStatus>
  visitedCount: number
  total:        number
  isReady:      boolean
  onSelectItem: (id: string) => void
}) {
  const progress = total > 0 ? Math.round((visitedCount / total) * 100) : 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-3 py-2.5 border-b border-border bg-surface-0">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-ink">{visitedCount} of {total} screen{total !== 1 ? 's' : ''} reviewed</p>
          <span className="text-2xs text-ink-3">{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-active overflow-hidden">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {pageGroups.map(({ pageId, pageName, items }) => (
          <div key={pageId}>
            <div className="px-3 py-1.5 bg-surface-1 border-b border-border-subtle sticky top-0 z-10">
              <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest">{pageName}</p>
            </div>
            {items.map(item => {
              const status = statuses[item.id] ?? 'unread'
              const cfg = STATUS[status]
              return (
                <button key={item.id} onClick={() => onSelectItem(item.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 border-b border-border-subtle hover:bg-surface-hover transition-colors text-left">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-ink truncate">{item.frameName}</p>
                    <p className="text-2xs text-ink-3">{item.changeCount} typography change{item.changeCount !== 1 ? 's' : ''}</p>
                  </div>
                  <span className={cn('text-2xs px-1.5 py-0.5 rounded font-medium shrink-0', cfg.cls)}>{cfg.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-ink-disabled shrink-0" />
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-border bg-surface-1 px-4 py-3 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          {isReady
            ? <p className="text-xs text-success font-medium">All screens reviewed — ready to apply</p>
            : <p className="text-xs text-ink-2">Open each screen to review before applying</p>
          }
        </div>
        <button disabled className="flex items-center gap-1.5 px-4 h-8 rounded bg-surface-active text-ink-disabled text-xs font-medium cursor-not-allowed select-none shrink-0"
          title="Apply available in next release">
          <Lock className="w-3.5 h-3.5" />Apply Changes
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ReviewChangesPage() {
  const { result }              = useAuditStore()
  const { assignments }         = useAssignmentStore()
  const { navigate }            = useUIStore()
  const { currentItemId, statuses, setCurrentItem, markStatus, setItems } = useReviewStore()

  const allGroups = useMemo(() =>
    (result?.groups ?? []) as unknown as AuditGroup<TypographyProperties>[],
    [result]
  )

  const reviewItems = useMemo(() => buildReviewItems(allGroups, assignments), [allGroups, assignments])
  const pageGroups  = useMemo(() => groupItemsByPage(reviewItems), [reviewItems])

  useEffect(() => { setItems(reviewItems) }, [reviewItems, setItems])

  const currentItem  = reviewItems.find(i => i.id === currentItemId) ?? null
  const currentIndex = currentItem ? reviewItems.indexOf(currentItem) : -1
  const visitedCount = reviewItems.filter(i => statuses[i.id] && statuses[i.id] !== 'unread').length
  const isReady      = reviewItems.length > 0 && visitedCount >= reviewItems.length

  // Also navigate canvas when item opens (highlights changed layers)
  useEffect(() => {
    if (!currentItem) return
    const layerIds = [...new Set(currentItem.changes.map(c => c.layerId))]
    sendToPlugin({ type: 'REVIEW_NAVIGATE', payload: { pageId: currentItem.pageId, layerIds } })
    return () => { sendToPlugin({ type: 'REVIEW_CLEAR_HIGHLIGHTS' }) }
  }, [currentItem?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <Target className="w-8 h-8 text-ink-disabled" strokeWidth={1.5} />
        <p className="text-sm font-medium text-ink">No scan data</p>
        <p className="text-xs text-ink-3">Run a scan to review typography migrations.</p>
        <button onClick={() => navigate('scan')} className="text-xs text-accent hover:underline">Run Scan</button>
      </div>
    )
  }

  if (reviewItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <Target className="w-8 h-8 text-ink-disabled" strokeWidth={1.5} />
        <p className="text-sm font-medium text-ink">No changes to review</p>
        <p className="text-xs text-ink-3 max-w-xs leading-relaxed">
          Assign typography signatures to target styles in Raw Values, then return here to review.
        </p>
        <button onClick={() => navigate('typography/raw')} className="text-xs text-accent hover:underline">Go to Raw Values</button>
      </div>
    )
  }

  if (currentItem) {
    return (
      <DetailView
        item={currentItem}
        status={statuses[currentItem.id] ?? 'unread'}
        index={currentIndex}
        total={reviewItems.length}
        prev={reviewItems[currentIndex - 1] ?? null}
        next={reviewItems[currentIndex + 1] ?? null}
        onBack={() => setCurrentItem(null)}
        onNavigate={setCurrentItem}
        onMarkStatus={(s) => markStatus(currentItem.id, s)}
      />
    )
  }

  return (
    <ListView
      pageGroups={pageGroups}
      statuses={statuses}
      visitedCount={visitedCount}
      total={reviewItems.length}
      isReady={isReady}
      onSelectItem={setCurrentItem}
    />
  )
}
