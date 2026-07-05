import { useMemo, useEffect } from 'react'
import {
  ChevronRight, ChevronLeft, ArrowLeft, Layers, Lock,
  Eye, CheckCircle, AlertTriangle, SkipForward, Target,
} from 'lucide-react'
import { useAuditStore }      from '../../store/audit'
import { useAssignmentStore } from '../../store/assignment'
import { useUIStore }         from '../../store/ui'
import { useReviewStore }     from '../../store/reviewStore'
import { buildReviewItems, groupItemsByPage, diffTypographyToTarget } from '../../lib/review-engine'
import { sendToPlugin }       from '../../hooks/useSendMessage'
import type { ReviewItem, ReviewStatus } from '../../../shared/review'
import type { AuditGroup }    from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'
import { cn } from '../../lib/cn'

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS: Record<ReviewStatus, { label: string; icon: React.ElementType; cls: string }> = {
  unread:            { label: 'Unread',          icon: Eye,           cls: 'bg-surface-active text-ink-3' },
  reviewed:          { label: 'Reviewed',        icon: CheckCircle,   cls: 'bg-success-subtle text-success' },
  'needs-attention': { label: 'Needs Attention', icon: AlertTriangle, cls: 'bg-warning-subtle text-warning' },
  skipped:           { label: 'Skipped',         icon: SkipForward,   cls: 'bg-surface-0 text-ink-disabled' },
  accepted:          { label: 'Accepted',        icon: CheckCircle,   cls: 'bg-accent-subtle text-accent' },
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  const cfg = STATUS[status]
  const Icon = cfg.icon
  return (
    <span className={cn('inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded font-medium', cfg.cls)}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Change row (Part 6 — diff inspector)
// ---------------------------------------------------------------------------

function ChangeRow({ change }: { change: ReviewItem['changes'][0] }) {
  const { current, planned } = change
  const t = planned.target

  const beforeStr = `${current.fontFamily} ${current.fontStyle} / ${current.fontSize}px`

  let afterName   = planned.label
  let afterDetail = ''
  if (t.type === 'existing-style' || t.type === 'new-style' || t.type === 'manual-values') {
    const tt = t as { fontFamily: string; fontStyle: string; fontSize: number }
    afterDetail = `${tt.fontFamily} ${tt.fontStyle} / ${tt.fontSize}px`
  } else if (t.type === 'existing-variable') {
    afterDetail = t.variableName
  }

  const diffs = diffTypographyToTarget(current, t)

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface-0">
      {/* Layer name */}
      <div className="px-3 py-2 border-b border-border-subtle bg-surface-1">
        <p className="text-xs font-medium text-ink truncate">{change.layerName}</p>
      </div>

      {/* Before / After */}
      <div className="grid grid-cols-2 divide-x divide-border-subtle">
        <div className="px-3 py-2">
          <p className="text-2xs text-ink-disabled mb-0.5">Before</p>
          <p className="text-2xs text-ink-2 leading-relaxed">{beforeStr}</p>
        </div>
        <div className="px-3 py-2">
          <p className="text-2xs text-ink-disabled mb-0.5">After</p>
          <p className="text-2xs font-medium text-ink truncate">{afterName}</p>
          {afterDetail && afterDetail !== afterName && (
            <p className="text-2xs text-ink-3">{afterDetail}</p>
          )}
        </div>
      </div>

      {/* Property diff (only changed props) */}
      {diffs.length > 0 && (
        <div className="px-3 py-2 border-t border-border-subtle space-y-1">
          {diffs.map(d => (
            <div key={d.prop} className="flex items-center gap-2 text-2xs">
              <span className="text-ink-disabled w-20 shrink-0">{d.prop}</span>
              <span className="text-ink-3">{d.before}</span>
              <span className="text-ink-disabled">→</span>
              <span className="text-accent font-medium">{d.after}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail view (Parts 3, 6, 7)
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
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Navigation header */}
      <div className="shrink-0 border-b border-border bg-surface-1">
        <div className="flex items-center gap-2 px-3 py-2">
          <button onClick={onBack}
            className="flex items-center gap-1 text-xs text-ink-3 hover:text-ink transition-colors shrink-0">
            <ArrowLeft className="w-3.5 h-3.5" />All Screens
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-ink truncate">{item.frameName}</p>
            <p className="text-2xs text-ink-3">{item.pageName}</p>
          </div>
          <span className="text-2xs text-ink-disabled shrink-0">{index + 1} / {total}</span>
        </div>
        {/* Prev / Next screen */}
        <div className="flex border-t border-border-subtle">
          <button
            onClick={() => prev && onNavigate(prev.id)}
            disabled={!prev}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-2xs text-ink-3 hover:text-ink hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-r border-border-subtle"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {prev ? prev.frameName : 'First'}
          </button>
          <button
            onClick={() => next && onNavigate(next.id)}
            disabled={!next}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-2xs text-ink-3 hover:text-ink hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {next ? next.frameName : 'Last'}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Change list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest">
            {item.changeCount} change{item.changeCount !== 1 ? 's' : ''}
          </p>
          <StatusBadge status={status} />
        </div>

        {item.changes.map(change => (
          <ChangeRow key={change.layerId} change={change} />
        ))}
      </div>

      {/* Status footer (Part 7) */}
      <div className="shrink-0 border-t border-border bg-surface-1 px-3 py-2 flex items-center gap-2">
        <button
          onClick={() => onMarkStatus('reviewed')}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1.5 rounded text-2xs font-medium transition-colors',
            status === 'reviewed'
              ? 'bg-success-subtle text-success'
              : 'bg-surface-0 border border-border text-ink-2 hover:border-border-strong'
          )}
        >
          <CheckCircle className="w-3.5 h-3.5" />Reviewed
        </button>
        <button
          onClick={() => onMarkStatus('needs-attention')}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1.5 rounded text-2xs font-medium transition-colors',
            status === 'needs-attention'
              ? 'bg-warning-subtle text-warning'
              : 'bg-surface-0 border border-border text-ink-2 hover:border-border-strong'
          )}
        >
          <AlertTriangle className="w-3.5 h-3.5" />Flag
        </button>
        <button
          onClick={() => onMarkStatus('skipped')}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1.5 rounded text-2xs font-medium transition-colors',
            status === 'skipped'
              ? 'bg-surface-active text-ink-2'
              : 'bg-surface-0 border border-border text-ink-2 hover:border-border-strong'
          )}
        >
          <SkipForward className="w-3.5 h-3.5" />Skip
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <button
            onClick={() => prev && onNavigate(prev.id)}
            disabled={!prev}
            className="p-1.5 rounded text-ink-3 hover:text-ink hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => next && onNavigate(next.id)}
            disabled={!next}
            className="p-1.5 rounded text-ink-3 hover:text-ink hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// List view (Parts 2, 7, 8)
// ---------------------------------------------------------------------------

function ListView({
  pageGroups, statuses, visitedCount, total, isReady,
  onSelectItem,
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
      {/* Progress header */}
      <div className="shrink-0 px-3 py-2.5 border-b border-border bg-surface-0">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-ink">
            {visitedCount} of {total} screen{total !== 1 ? 's' : ''} reviewed
          </p>
          <span className="text-2xs text-ink-3">{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-active overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Frame list grouped by page */}
      <div className="flex-1 overflow-y-auto">
        {pageGroups.map(({ pageId, pageName, items }) => (
          <div key={pageId}>
            <div className="px-3 py-1.5 bg-surface-1 border-b border-border-subtle sticky top-0 z-10">
              <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest">{pageName}</p>
            </div>
            {items.map(item => {
              const status = statuses[item.id] ?? 'unread'
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectItem(item.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 border-b border-border-subtle hover:bg-surface-hover transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-ink truncate">{item.frameName}</p>
                    <p className="text-2xs text-ink-3">
                      <Layers className="w-3 h-3 inline mr-1" />
                      {item.changeCount} change{item.changeCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <StatusBadge status={status} />
                  <ChevronRight className="w-3.5 h-3.5 text-ink-disabled shrink-0" />
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Apply footer (Part 8) */}
      <div className="shrink-0 border-t border-border bg-surface-1 px-4 py-3 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          {isReady ? (
            <p className="text-xs text-success font-medium">All screens reviewed — ready to apply</p>
          ) : (
            <p className="text-xs text-ink-2">
              Review all {total} screens to enable Apply
            </p>
          )}
        </div>
        <button
          disabled
          className="flex items-center gap-1.5 px-4 h-8 rounded bg-surface-active text-ink-disabled text-xs font-medium cursor-not-allowed select-none shrink-0"
          title="Apply is not yet available — coming in the next release"
        >
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
  const {
    currentItemId, statuses,
    setCurrentItem, markStatus, setItems,
  } = useReviewStore()

  const allGroups = useMemo(() =>
    (result?.groups ?? []) as unknown as AuditGroup<TypographyProperties>[],
    [result]
  )

  // Build review items from scan + assignments
  const reviewItems = useMemo(() =>
    buildReviewItems(allGroups, assignments),
    [allGroups, assignments]
  )

  // Sync into store (so status is accessible anywhere)
  useEffect(() => { setItems(reviewItems) }, [reviewItems, setItems])

  const pageGroups     = useMemo(() => groupItemsByPage(reviewItems), [reviewItems])
  const currentItem    = reviewItems.find(i => i.id === currentItemId) ?? null
  const currentIndex   = currentItem ? reviewItems.indexOf(currentItem) : -1
  const visitedCount   = reviewItems.filter(i => statuses[i.id] && statuses[i.id] !== 'unread').length
  const isReady        = reviewItems.length > 0 && visitedCount >= reviewItems.length

  // Canvas navigation: select changed text layers when item opens (Part 4)
  useEffect(() => {
    if (!currentItem) return
    const layerIds = [...new Set(currentItem.changes.map(c => c.layerId))]
    sendToPlugin({ type: 'REVIEW_NAVIGATE', payload: { pageId: currentItem.pageId, layerIds } })
    return () => { sendToPlugin({ type: 'REVIEW_CLEAR_HIGHLIGHTS' }) }
  }, [currentItem?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Empty: no scan
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <Target className="w-8 h-8 text-ink-disabled" strokeWidth={1.5} />
        <p className="text-sm font-medium text-ink">No scan data</p>
        <p className="text-xs text-ink-3">Run a scan to start reviewing typography changes.</p>
        <button onClick={() => navigate('scan')} className="text-xs text-accent hover:underline">Run Scan</button>
      </div>
    )
  }

  // Empty: no assignments
  if (reviewItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <Target className="w-8 h-8 text-ink-disabled" strokeWidth={1.5} />
        <p className="text-sm font-medium text-ink">No changes planned</p>
        <p className="text-xs text-ink-3 max-w-xs leading-relaxed">
          Assign typography signatures to target styles in Raw Values, then return here to review.
        </p>
        <button onClick={() => navigate('typography/raw')} className="text-xs text-accent hover:underline">
          Go to Raw Values
        </button>
      </div>
    )
  }

  // Detail view
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
        onNavigate={(id) => setCurrentItem(id)}
        onMarkStatus={(s) => markStatus(currentItem.id, s)}
      />
    )
  }

  // List view
  return (
    <ListView
      pageGroups={pageGroups}
      statuses={statuses}
      visitedCount={visitedCount}
      total={reviewItems.length}
      isReady={isReady}
      onSelectItem={(id) => setCurrentItem(id)}
    />
  )
}
