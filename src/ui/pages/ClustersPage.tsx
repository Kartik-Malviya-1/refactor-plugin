import { useEffect } from 'react'
import { GitBranch } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { StrategySelector } from '../components/clusters/StrategySelector'
import { ClusterCard } from '../components/clusters/ClusterCard'
import { useUIStore } from '../store/ui'
import { useAuditStore } from '../store/audit'
import { useAssignmentStore } from '../store/assignment'
import { useTypographyClusters } from '../hooks/useTypographyClusters'
import { usePlanningDataStore } from '../store/planningData'
import { sendToPlugin } from '../hooks/useSendMessage'

export function ClustersPage() {
  const { navigate }    = useUIStore()
  const { result }      = useAuditStore()
  const clusters        = useTypographyClusters()
  const { assignments } = useAssignmentStore()
  const { loaded }      = usePlanningDataStore()

  // Fetch styles/variables for the assignment panel
  useEffect(() => {
    if (!loaded) sendToPlugin({ type: 'GET_PLANNING_DATA' })
  }, [loaded])

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState icon={GitBranch} title="No scan data"
          description="Run a scan to generate Typography Clusters."
          action={<Button variant="primary" size="sm" onClick={() => navigate('scan')}>Run Scan</Button>}
        />
      </div>
    )
  }

  // Progress stats
  const allSignatureIds = clusters.flatMap(c => c.members.map(m => m.id))
  const totalSigs    = allSignatureIds.length
  const assignedSigs = allSignatureIds.filter(id => assignments[id]).length
  const remaining    = totalSigs - assignedSigs

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Strategy selector */}
      <StrategySelector />

      {/* Progress header */}
      <div className="shrink-0 border-b border-border-subtle bg-surface-1 px-5 py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-ink">
            {clusters.length} Typography Cluster{clusters.length !== 1 ? 's' : ''}
          </p>
          <p className="text-2xs text-ink-3">
            {assignedSigs.toLocaleString()} / {totalSigs.toLocaleString()} signatures assigned
          </p>
        </div>
        {totalSigs > 0 && (
          <div className="h-1 bg-surface-hover rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${Math.round(assignedSigs / totalSigs * 100)}%` }} />
          </div>
        )}
        {remaining > 0 && (
          <p className="text-2xs text-ink-disabled mt-1">{remaining.toLocaleString()} remaining</p>
        )}
      </div>

      {/* Column headers */}
      <div className="shrink-0 grid bg-surface-0 border-b border-border text-2xs font-semibold text-ink-3 uppercase tracking-wider px-3"
        style={{ gridTemplateColumns: '28px auto 1fr auto auto auto' }}>
        <div />
        <div className="py-2">Conf.</div>
        <div className="py-2">Cluster</div>
        <div className="py-2 text-right">Sigs</div>
        <div className="py-2 text-right">Layers</div>
        <div className="py-2 text-right">Status</div>
      </div>

      {/* Cluster list */}
      <div className="flex-1 overflow-y-auto">
        {clusters.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-ink-disabled">No clusters generated. Try changing the clustering strategy.</p>
          </div>
        ) : (
          clusters.map(cluster => <ClusterCard key={cluster.id} cluster={cluster} />)
        )}
      </div>
    </div>
  )
}
