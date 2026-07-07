import { useMemo, useEffect } from 'react'
import {
  ChevronRight, ChevronLeft, ArrowLeft,
  CheckCircle, AlertTriangle, SkipForward, Target,
  Loader2, Lock, CheckCheck, Copy, Eye,
} from 'lucide-react'
import { useAuditStore }      from '../../store/audit'
import { useAssignmentStore } from '../../store/assignment'
import { useUIStore }         from '../../store/ui'
import { useReviewStore }     from '../../store/reviewStore'
import { useApplyStore }      from '../../store/applyStore'
import { buildReviewItems, groupItemsByPage, diffTypographyToTarget } from '../../lib/review-engine'
import { sendToPlugin }       from '../../hooks/useSendMessage'
import type { ReviewItem, ReviewStatus } from '../../../shared/review'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'
import type { ApplyEntry } from '../../../shared/apply-types'
import type { MutationResult } from '../../../shared/apply-types'
import { cn } from '../../lib/cn'

function buildApplyEntries(
  reviewItems: ReviewItem[],
  assignments: Record<string, import('../../../clustering/types').AssignedTarget>
): ApplyEntry[] {
  const entries: ApplyEntry[] = []
  for (const item of reviewItems) {
    for (const change of item.changes) {
      if (change.planned.target.type === 'skip') continue
      entries.push({ nodeId: change.layerId, pageId: item.pageId, pageName: item.pageName, nodeName: change.layerName, sigKey: change.signatureKey, target: change.planned.target })
    }
  }
  return entries
}

const STATUS: Record<ReviewStatus, { label: string; cls: string }> = {
  unread:            { label: 'Unread',          cls: 'bg-surface-active text-ink-3' },
  reviewed:          { label: 'Reviewed',        cls: 'bg-success-subtle text-success' },
  'needs-attention': { label: 'Needs Attention', cls: 'bg-warning-subtle text-warning' },
  skipped:           { label: 'Skipped',         cls: 'bg-surface-0 text-ink-disabled' },
  accepted:          { label: 'Accepted',        cls: 'bg-accent-subtle text-accent' },
}

function ChangeRow({ change }: { change: ReviewItem['changes'][0] }) {
  const { current, planned } = change
  const t = planned.target
  const beforeStr = `${current.fontFamily} ${current.fontStyle} / ${current.fontSize}px`
  let afterName = planned.label, afterDetail = ''
  if (t.type === 'existing-style' || t.type === 'new-style' || t.type === 'manual-values') {
    const tt = t as { fontFamily: string; fontStyle: string; fontSize: number }
    afterDetail = `${tt.fontFamily} ${tt.fontStyle} / ${tt.fontSize}px`
  } else if (t.type === 'existing-variable') { afterDetail = t.variableName }
  const diffs = diffTypographyToTarget(current, t)
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface-0">
      <div className="px-3 py-1.5 border-b border-border-subtle bg-surface-1">
        <p className="text-xs font-medium text-ink truncate">{change.layerName}</p>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border-subtle">
        <div className="px-3 py-2">
          <p className="text-2xs text-ink-disabled mb-0.5">Before</p>
          <p className="text-2xs text-ink-2">{beforeStr}</p>
        </div>
        <div className="px-3 py-2">
          <p className="text-2xs text-ink-disabled mb-0.5">After</p>
          <p className="text-2xs font-medium text-ink truncate">{afterName}</p>
          {afterDetail && afterDetail !== afterName && <p className="text-2xs text-ink-3">{afterDetail}</p>}
        </div>
      </div>
      {diffs.length > 0 && (
        <div className="px-3 py-1.5 border-t border-border-subtle space-y-0.5">
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

function DetailView({ item, status, index, total, prev, next, onBack, onNavigate, onMarkStatus }: {
  item: ReviewItem; status: ReviewStatus; index: number; total: number
  prev: ReviewItem | null; next: ReviewItem | null
  onBack: () => void; onNavigate: (id: string) => void; onMarkStatus: (s: ReviewStatus) => void
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 border-b border-border bg-surface-1">
        <div className="flex items-center gap-2 px-3 py-2">
          <button onClick={onBack} className="flex items-center gap-1 text-xs text-ink-3 hover:text-ink transition-colors"><ArrowLeft className="w-3.5 h-3.5" />All Screens</button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-xs font-semibold text-ink truncate">{item.frameName}</p>
            <p className="text-2xs text-ink-3">{item.pageName}</p>
          </div>
          <span className="text-2xs text-ink-disabled">{index + 1} / {total}</span>
        </div>
        <div className="flex border-t border-border-subtle">
          <button disabled={!prev} onClick={() => prev && onNavigate(prev.id)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-2xs text-ink-3 hover:text-ink hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed border-r border-border-subtle transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />{prev?.frameName ?? 'First'}
          </button>
          <button disabled={!next} onClick={() => next && onNavigate(next.id)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-2xs text-ink-3 hover:text-ink hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            {next?.frameName ?? 'Last'}<ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest">{item.changeCount} change{item.changeCount !== 1 ? 's' : ''}</p>
          <span className={cn('text-2xs px-1.5 py-0.5 rounded font-medium', STATUS[status].cls)}>{STATUS[status].label}</span>
        </div>
        {item.changes.map(c => <ChangeRow key={c.layerId} change={c} />)}
      </div>
      <div className="shrink-0 border-t border-border bg-surface-1 px-3 py-2 flex items-center gap-2">
        {([{ s: 'reviewed' as ReviewStatus, icon: CheckCircle, label: 'Reviewed' }, { s: 'needs-attention' as ReviewStatus, icon: AlertTriangle, label: 'Flag' }, { s: 'skipped' as ReviewStatus, icon: SkipForward, label: 'Skip' }]).map(({ s, icon: Icon, label }) => (
          <button key={s} onClick={() => onMarkStatus(s)}
            className={cn('flex items-center gap-1 px-2 py-1.5 rounded text-2xs font-medium transition-colors border',
              status === s ? STATUS[s].cls + ' border-current/30' : 'bg-surface-0 border-border text-ink-2 hover:border-border-strong'
            )}><Icon className="w-3.5 h-3.5" />{label}</button>
        ))}
        <div className="flex-1" />
        <button disabled={!prev} onClick={() => prev && onNavigate(prev.id)} className="p-1 rounded text-ink-3 hover:text-ink hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
        <button disabled={!next} onClick={() => next && onNavigate(next.id)} className="p-1 rounded text-ink-3 hover:text-ink hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  )
}

function ApplyProgressView() {
  const { progress } = useApplyStore()
  if (!progress) return null
  const pct = progress.total > 0 ? Math.round((progress.applied / progress.total) * 100) : 0
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <Loader2 className="w-8 h-8 animate-spin text-accent" />
      <div className="text-center">
        <p className="text-sm font-semibold text-ink">{progress.phase === 'validating' ? 'Validating…' : 'Applying typography…'}</p>
        <p className="text-xs text-ink-3 mt-1">{progress.applied.toLocaleString()} / {progress.total.toLocaleString()} layers</p>
        {progress.current && <p className="text-2xs text-ink-disabled mt-1 truncate max-w-xs">"{progress.current}"</p>}
      </div>
      <div className="w-full max-w-xs">
        <div className="h-2 rounded-full bg-surface-active overflow-hidden">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-2xs text-ink-disabled text-center mt-1">{pct}%</p>
      </div>
    </div>
  )
}

function ReportView({ onDone }: { onDone: () => void }) {
  const { report } = useApplyStore()
  if (!report) return null
  const dur = report.durationMs >= 1000 ? `${(report.durationMs/1000).toFixed(1)}s` : `${report.durationMs}ms`

  // Group successful results by page for the "View on canvas" buttons
  const successByPage = useMemo(() => {
    const map = new Map<string, { pageName: string; nodeIds: string[] }>()
    for (const r of report.results) {
      if (r.status !== 'success') continue
      if (!map.has(r.pageId)) map.set(r.pageId, { pageName: r.pageName, nodeIds: [] })
      map.get(r.pageId)!.nodeIds.push(r.nodeId)
    }
    return [...map.entries()].map(([pageId, v]) => ({ pageId, ...v }))
  }, [report])

  function copyReport() {
    const lines = [`Typography Migration — ${new Date(report.completedAt).toLocaleString()}`, `Duration: ${dur}`, `Applied: ${report.successful}  Skipped: ${report.skipped}  Failed: ${report.failed}  Total: ${report.totalNodes}`]
    if (report.failed > 0) { lines.push('', 'Failures:'); for (const r of (report.results as MutationResult[]).filter(r=>r.status==='failed').slice(0,20)) lines.push(`  [${r.pageName}] ${r.nodeName}: ${r.error}`) }
    navigator.clipboard?.writeText(lines.join('\n')).catch(()=>{})
  }

  function viewOnCanvas(pageId: string, nodeIds: string[]) {
    sendToPlugin({ type: 'HIGHLIGHT_NODES', payload: { pageId, nodeIds } })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-center mb-4">
          <div className={cn('w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3', report.failed > 0 ? 'bg-warning-subtle' : 'bg-success-subtle')}>
            <CheckCheck className={cn('w-6 h-6', report.failed > 0 ? 'text-warning' : 'text-success')} />
          </div>
          <p className="text-base font-semibold text-ink">{report.failed > 0 ? 'Migration complete with issues' : 'Migration complete'}</p>
          <p className="text-xs text-ink-3 mt-1">{dur}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {[{label:'Applied',value:report.successful,cls:'text-success'},{label:'Skipped',value:report.skipped,cls:'text-ink-2'},{label:'Failed',value:report.failed,cls:report.failed>0?'text-error':'text-ink-2'},{label:'Total',value:report.totalNodes,cls:'text-ink'}].map(({label,value,cls})=>(
            <div key={label} className="border border-border rounded-lg p-2.5 text-center">
              <p className={cn('text-xl font-bold tabular-nums',cls)}>{value.toLocaleString()}</p>
              <p className="text-2xs text-ink-3 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Per-page view buttons */}
        {successByPage.length > 0 && (
          <div className="mb-4">
            <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Changed layers</p>
            <div className="space-y-1.5">
              {successByPage.map(({ pageId, pageName, nodeIds }) => (
                <button key={pageId} onClick={() => viewOnCanvas(pageId, nodeIds)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded border border-border hover:border-border-strong hover:bg-surface-hover transition-colors text-left">
                  <Eye className="w-3.5 h-3.5 text-ink-3 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-ink truncate">{pageName}</p>
                    <p className="text-2xs text-ink-3">{nodeIds.length} layer{nodeIds.length !== 1 ? 's' : ''} changed</p>
                  </div>
                  <span className="text-2xs text-accent shrink-0">View →</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {report.failed > 0 && (
          <div className="border border-warning/30 bg-warning-subtle/40 rounded-lg p-3">
            <p className="text-xs font-semibold text-warning mb-1">Failures</p>
            {(report.results as MutationResult[]).filter(r=>r.status==='failed').slice(0,5).map((r,i)=>(
              <p key={i} className="text-2xs text-ink-3 truncate">[{r.pageName}] {r.nodeName}: {r.error}</p>
            ))}
            {report.failed > 5 && <p className="text-2xs text-ink-disabled">+{report.failed-5} more</p>}
          </div>
        )}
      </div>
      <div className="shrink-0 border-t border-border bg-surface-1 px-4 py-3 flex items-center gap-2">
        <button onClick={copyReport} className="flex items-center gap-1.5 px-3 h-8 rounded border border-border text-xs text-ink-2 hover:border-border-strong transition-colors"><Copy className="w-3.5 h-3.5" />Copy Report</button>
        <div className="flex-1" />
        <button onClick={onDone} className="px-4 h-8 rounded bg-accent text-accent-fg text-xs font-medium hover:bg-accent-hover transition-colors">Done</button>
      </div>
    </div>
  )
}

function ListView({ pageGroups, statuses, visitedCount, total, onSelectItem, onApply }: {
  pageGroups: ReturnType<typeof groupItemsByPage>; statuses: Record<string, ReviewStatus>
  visitedCount: number; total: number; onSelectItem: (id: string) => void; onApply: () => void
}) {
  const { phase } = useApplyStore()
  const progress = Math.round((visitedCount / Math.max(total, 1)) * 100)
  const canApply = total > 0 && phase === 'idle'
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
              return (
                <button key={item.id} onClick={() => onSelectItem(item.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 border-b border-border-subtle hover:bg-surface-hover transition-colors text-left">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-ink truncate">{item.frameName}</p>
                    <p className="text-2xs text-ink-3">{item.changeCount} change{item.changeCount !== 1 ? 's' : ''}</p>
                  </div>
                  <span className={cn('text-2xs px-1.5 py-0.5 rounded font-medium shrink-0', STATUS[status].cls)}>{STATUS[status].label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-ink-disabled shrink-0" />
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t border-border bg-surface-1 px-4 py-3 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          {visitedCount < total
            ? <p className="text-xs text-ink-2">{total - visitedCount} screen{total-visitedCount!==1?'s':''} not yet reviewed</p>
            : <p className="text-xs text-success font-medium">All screens reviewed</p>
          }
        </div>
        <button onClick={onApply} disabled={!canApply}
          className={cn('flex items-center gap-1.5 px-4 h-8 rounded text-xs font-medium transition-colors shrink-0',
            canApply ? 'bg-accent text-accent-fg hover:bg-accent-hover' : 'bg-surface-active text-ink-disabled cursor-not-allowed'
          )}>
          {!canApply && <Lock className="w-3.5 h-3.5" />}Apply Changes
        </button>
      </div>
    </div>
  )
}

export function ReviewChangesPage() {
  const { result }              = useAuditStore()
  const { assignments }         = useAssignmentStore()
  const { navigate }            = useUIStore()
  const { currentItemId, statuses, setCurrentItem, markStatus, setItems } = useReviewStore()
  const { phase, reset: resetApply } = useApplyStore()

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

  // Navigate canvas when a review item opens: selects the affected text nodes
  // so the user can see exactly what will change before clicking Apply.
  useEffect(() => {
    if (!currentItem) return
    const layerIds = [...new Set(currentItem.changes.map(c => c.layerId))]
    sendToPlugin({ type: 'REVIEW_NAVIGATE', payload: { pageId: currentItem.pageId, layerIds } })
    return () => { sendToPlugin({ type: 'REVIEW_CLEAR_HIGHLIGHTS' }) }
  }, [currentItem?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleApply() {
    const entries = buildApplyEntries(reviewItems, assignments)
    if (!entries.length) return
    useApplyStore.getState().startApply()
    sendToPlugin({ type: 'APPLY_PLAN', payload: { entries } })
  }

  if (!result) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
      <Target className="w-8 h-8 text-ink-disabled" strokeWidth={1.5} />
      <p className="text-sm font-medium text-ink">No scan data</p>
      <p className="text-xs text-ink-3">Run a scan to review typography migrations.</p>
      <button onClick={() => navigate('scan')} className="text-xs text-accent hover:underline">Run Scan</button>
    </div>
  )
  if (reviewItems.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
      <Target className="w-8 h-8 text-ink-disabled" strokeWidth={1.5} />
      <p className="text-sm font-medium text-ink">No changes to review</p>
      <p className="text-xs text-ink-3 max-w-xs leading-relaxed">Assign typography signatures in Raw Values, then return here.</p>
      <button onClick={() => navigate('typography/raw')} className="text-xs text-accent hover:underline">Go to Raw Values</button>
    </div>
  )
  if (phase === 'applying' || phase === 'validating') return <ApplyProgressView />
  if (phase === 'complete') return <ReportView onDone={resetApply} />
  if (currentItem) return (
    <DetailView
      item={currentItem} status={statuses[currentItem.id] ?? 'unread'}
      index={currentIndex} total={reviewItems.length}
      prev={reviewItems[currentIndex - 1] ?? null} next={reviewItems[currentIndex + 1] ?? null}
      onBack={() => setCurrentItem(null)} onNavigate={setCurrentItem}
      onMarkStatus={(s) => markStatus(currentItem.id, s)}
    />
  )
  return <ListView pageGroups={pageGroups} statuses={statuses} visitedCount={visitedCount} total={reviewItems.length} onSelectItem={setCurrentItem} onApply={handleApply} />
}
