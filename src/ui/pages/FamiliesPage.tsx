import { useState, useMemo } from 'react'
import { ChevronRight, MousePointerClick, AlertTriangle, Layers } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { TypographyPreview } from '../components/audit/TypographyPreview'
import { useUIStore } from '../store/ui'
import { useAuditStore } from '../store/audit'
import { useCandidateFamilies } from '../hooks/useCandidateFamilies'
import type { CandidateFamily } from '../../similarity/types'
import type { ConfidenceLabel } from '../../similarity/types'
import { cn } from '../lib/cn'
import type { SourceType } from '../../shared/types'

// ---------------------------------------------------------------------------
// Confidence display
// ---------------------------------------------------------------------------

const CONFIDENCE_COLOR: Record<ConfidenceLabel, string> = {
  'Very Strong':         'text-success',
  'Strong':              'text-accent',
  'Review Recommended':  'text-warning',
  'Weak':                'text-danger',
}

const CONFIDENCE_BG: Record<ConfidenceLabel, string> = {
  'Very Strong':         'bg-success-subtle border-success/20',
  'Strong':              'bg-accent-subtle border-accent/20',
  'Review Recommended':  'bg-warning-subtle border-warning/20',
  'Weak':                'bg-danger-subtle border-danger/20',
}

const SOURCE_BADGE: Partial<Record<SourceType, string>> = {
  'Raw Values':         'bg-surface-active text-ink-2 border border-border',
  'Local Text Style':   'bg-accent-subtle text-accent border border-accent/20',
  'Library Text Style': 'bg-success-subtle text-success border border-success/20',
  'Variable':           'bg-warning-subtle text-warning border border-warning/20',
  'Unknown':            'bg-surface-0 text-ink-disabled border border-border-subtle',
}

// ---------------------------------------------------------------------------
// Member row (inside expanded family)
// ---------------------------------------------------------------------------

function MemberRow({
  group,
  similarity,
  isOutlier,
  onNavigate,
}: {
  group: { id: string; label: string; count: number; descriptor: import('../../modules/typography/types').TypographyProperties; source?: string }
  similarity: number
  isOutlier: boolean
  onNavigate: () => void
}) {
  return (
    <div className="flex items-center gap-2 pl-10 pr-3 py-1.5 border-b border-border-subtle last:border-0 hover:bg-surface-hover transition-colors">
      <TypographyPreview properties={group.descriptor} className="w-8 h-6 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-ink truncate">{group.label}</p>
        <p className="text-2xs text-ink-3">{group.count.toLocaleString()} layers</p>
      </div>
      {isOutlier && (
        <span title="Outlier: significantly differs from family dominant">
          <AlertTriangle className="w-3 h-3 text-warning shrink-0" />
        </span>
      )}
      <span className={cn(
        'text-2xs tabular-nums px-1.5 py-0.5 rounded border',
        similarity >= 90 ? 'bg-success-subtle text-success border-success/20'
          : similarity >= 75 ? 'bg-accent-subtle text-accent border-accent/20'
          : 'bg-warning-subtle text-warning border-warning/20'
      )}>
        {similarity}%
      </span>
      {group.source && SOURCE_BADGE[group.source as SourceType] && (
        <span className={cn('text-2xs px-1.5 py-0.5 rounded hidden sm:inline', SOURCE_BADGE[group.source as SourceType])}>
          {group.source === 'Local Text Style' ? 'Local'
            : group.source === 'Library Text Style' ? 'Library'
            : group.source}
        </span>
      )}
      <button
        onClick={onNavigate}
        className="shrink-0 p-1 rounded text-ink-3 hover:text-accent hover:bg-accent-subtle transition-colors"
        title="Open in Typography Signatures inspector"
      >
        <MousePointerClick className="w-3 h-3" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Family row
// ---------------------------------------------------------------------------

function FamilyRow({
  family,
  expanded,
  onToggle,
  onMemberNavigate,
}: {
  family: CandidateFamily
  expanded: boolean
  onToggle: () => void
  onMemberNavigate: (groupId: string) => void
}) {
  const { dominant, confidenceLabel, confidence } = family

  return (
    <>
      <div
        onClick={onToggle}
        className="grid items-center cursor-pointer select-none hover:bg-surface-hover transition-colors border-b border-border-subtle"
        style={{ gridTemplateColumns: '32px 1fr 120px 80px 80px 64px' }}
      >
        {/* Expand chevron */}
        <div className="flex items-center justify-center h-10">
          <ChevronRight
            className={cn('w-3.5 h-3.5 text-ink-3 transition-transform duration-120', expanded && 'rotate-90')}
          />
        </div>

        {/* Family name + dominant preview */}
        <div className="flex items-center gap-2 py-2 pr-2 min-w-0">
          <TypographyPreview
            properties={{ ...dominant, fontSize: Math.min(dominant.fontSize, 13) }}
            className="w-8 h-7 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink truncate leading-tight">
              {dominant.fontFamily} {dominant.fontStyle}
            </p>
            <p className="text-xs text-ink-3">{dominant.fontSize}px / {dominant.fontWeight}</p>
          </div>
        </div>

        {/* Confidence */}
        <div className="pr-2">
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium',
            CONFIDENCE_BG[confidenceLabel]
          )}>
            <span className={CONFIDENCE_COLOR[confidenceLabel]}>{confidence}%</span>
            <span className={cn('text-2xs', CONFIDENCE_COLOR[confidenceLabel])}>
              {confidenceLabel === 'Very Strong' ? 'Very Strong'
                : confidenceLabel === 'Strong' ? 'Strong'
                : confidenceLabel === 'Review Recommended' ? 'Review'
                : 'Weak'}
            </span>
          </span>
        </div>

        {/* Signatures */}
        <div className="text-sm tabular-nums text-ink-2 text-right pr-4">
          {family.signatureCount}
        </div>

        {/* Layers */}
        <div className="text-sm tabular-nums text-ink text-right pr-4">
          {family.totalLayers.toLocaleString()}
        </div>

        {/* Outliers */}
        <div className="flex items-center justify-center">
          {family.outlierCount > 0 ? (
            <span className="flex items-center gap-1 text-xs text-warning">
              <AlertTriangle className="w-3 h-3" />
              {family.outlierCount}
            </span>
          ) : (
            <span className="text-xs text-ink-disabled">—</span>
          )}
        </div>
      </div>

      {/* Expanded member list */}
      {expanded && (
        <div className="bg-surface-0">
          {family.members.map((member) => (
            <MemberRow
              key={member.id}
              group={member as Parameters<typeof MemberRow>[0]['group']}
              similarity={family.memberSimilarities.get(member.id) ?? 100}
              isOutlier={family.outlierIds.has(member.id)}
              onNavigate={() => onMemberNavigate(member.id)}
            />
          ))}
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type SortField = 'layers' | 'confidence' | 'signatures' | 'outliers'

export function FamiliesPage() {
  const { navigate, selectGroup, setSearchQuery } = useUIStore()
  const { result } = useAuditStore()
  const families = useCandidateFamilies()

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>('layers')

  const sorted = useMemo(() => {
    return [...families].sort((a, b) => {
      switch (sortField) {
        case 'confidence':  return b.confidence - a.confidence
        case 'signatures':  return b.signatureCount - a.signatureCount
        case 'outliers':    return b.outlierCount - a.outlierCount
        default:            return b.totalLayers - a.totalLayers
      }
    })
  }, [families, sortField])

  const stats = useMemo(() => {
    if (families.length === 0) return null
    const avgSize       = result ? (result.groups.length / families.length) : 0
    const avgConfidence = Math.round(families.reduce((s, f) => s + f.confidence, 0) / families.length)
    const totalOutliers = families.reduce((s, f) => s + f.outlierCount, 0)
    const familiesWithMultiple = families.filter(f => f.signatureCount > 1).length
    return { avgSize: Math.round(avgSize * 10) / 10, avgConfidence, totalOutliers, familiesWithMultiple }
  }, [families, result])

  function toggleExpand(id: string) {
    const next = new Set(expandedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setExpandedIds(next)
  }

  function navigateToGroup(groupId: string) {
    setSearchQuery('')
    selectGroup(groupId)
    navigate('signatures')
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          icon={Layers}
          title="No scan data"
          description="Run a scan to generate Candidate Families."
          action={<Button variant="primary" size="sm" onClick={() => navigate('scan')}>Run Scan</Button>}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-surface-1 px-5 py-3">
        <p className="text-sm font-semibold text-ink">Candidate Families</p>
        <p className="text-xs text-ink-3 mt-0.5">
          {families.length} families from {result.groups.length.toLocaleString()} signatures
        </p>
      </div>

      {/* Summary cards */}
      {stats && (
        <div className="shrink-0 px-4 py-3 border-b border-border-subtle bg-surface-0">
          <div className="flex gap-2">
            {([
              ['Families',    families.length,          undefined],
              ['Avg Size',    stats.avgSize,             'sigs/family'],
              ['Avg Confidence', `${stats.avgConfidence}%`, undefined],
              ['Outliers',    stats.totalOutliers,       'total'],
              ['Can Consolidate', stats.familiesWithMultiple, 'families'],
            ] as [string, string|number, string|undefined][]).map(([label, value, sub]) => (
              <div key={label} className="flex-1 bg-surface-1 border border-border rounded px-2.5 py-2 min-w-0">
                <p className="text-2xs text-ink-3 font-medium uppercase tracking-wider mb-1 truncate">{label}</p>
                <p className="text-lg font-semibold text-ink tabular-nums leading-none">{String(value)}</p>
                {sub && <p className="text-2xs text-ink-3 mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Column headers */}
      <div
        className="shrink-0 grid bg-surface-0 border-b border-border text-2xs font-semibold text-ink-3 uppercase tracking-wider"
        style={{ gridTemplateColumns: '32px 1fr 120px 80px 80px 64px' }}
      >
        <div />
        <div className="py-2">Family</div>
        <button onClick={() => setSortField('confidence')} className={cn('py-2 text-left hover:text-ink', sortField === 'confidence' && 'text-accent')}>
          Confidence
        </button>
        <button onClick={() => setSortField('signatures')} className={cn('py-2 text-right pr-4 hover:text-ink', sortField === 'signatures' && 'text-accent')}>
          Sigs
        </button>
        <button onClick={() => setSortField('layers')} className={cn('py-2 text-right pr-4 hover:text-ink', sortField === 'layers' && 'text-accent')}>
          Layers
        </button>
        <button onClick={() => setSortField('outliers')} className={cn('py-2 text-center hover:text-ink', sortField === 'outliers' && 'text-accent')}>
          Out.
        </button>
      </div>

      {/* Family list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map((family) => (
          <FamilyRow
            key={family.id}
            family={family}
            expanded={expandedIds.has(family.id)}
            onToggle={() => toggleExpand(family.id)}
            onMemberNavigate={navigateToGroup}
          />
        ))}
      </div>
    </div>
  )
}
