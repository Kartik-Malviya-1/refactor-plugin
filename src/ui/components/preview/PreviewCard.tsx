import { useState } from 'react'
import { ChevronRight, AlertTriangle } from 'lucide-react'
import { cn } from '../../lib/cn'
import { TypographyPreview } from '../audit/TypographyPreview'
import type { PreviewItem, RiskLevel, PropertyChange } from '../../../preview/types'

// ---------------------------------------------------------------------------
// Risk badge
// ---------------------------------------------------------------------------

const RISK_STYLE: Record<RiskLevel, string> = {
  'Low':       'bg-success-subtle text-success border border-success/20',
  'Medium':    'bg-warning-subtle text-warning border border-warning/20',
  'High':      'bg-danger-subtle text-danger border border-danger/20',
  'Very High': 'bg-danger text-white border border-danger',
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-2xs font-medium', RISK_STYLE[risk])}>{risk}</span>
}

// ---------------------------------------------------------------------------
// Before vs After table
// ---------------------------------------------------------------------------

function BeforeAfterTable({ changes }: { changes: PropertyChange[] }) {
  return (
    <div className="overflow-hidden rounded border border-border">
      <div className="grid bg-surface-0 border-b border-border text-2xs font-semibold text-ink-3 uppercase tracking-wider"
        style={{ gridTemplateColumns: '120px 1fr 1fr' }}>
        <div className="px-2 py-1.5">Property</div>
        <div className="px-2 py-1.5">Before</div>
        <div className="px-2 py-1.5">After</div>
      </div>
      {changes.map((c, i) => (
        <div key={i}
          className={cn(
            'grid items-center border-b border-border-subtle last:border-0 text-xs',
            c.changed ? 'bg-warning-subtle/40' : 'bg-surface-1'
          )}
          style={{ gridTemplateColumns: '120px 1fr 1fr' }}
        >
          <div className={cn('px-2 py-1.5 font-medium', c.changed ? 'text-warning' : 'text-ink-3')}>
            {c.property}
          </div>
          <div className="px-2 py-1.5 text-ink-2 font-mono">{c.before}</div>
          <div className={cn('px-2 py-1.5 font-mono', c.inherited ? 'text-ink-disabled italic' : c.changed ? 'text-warning font-semibold' : 'text-ink-2')}>
            {c.inherited ? 'Inherited' : c.after}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main card
// ---------------------------------------------------------------------------

export function PreviewCard({ item }: { item: PreviewItem }) {
  const [expanded, setExpanded] = useState(false)
  const hasIssues = item.validationIssues.length > 0

  return (
    <div className="border-b border-border-subtle">
      {/* Collapsed row */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="grid items-center cursor-pointer hover:bg-surface-hover transition-colors px-3"
        style={{ gridTemplateColumns: '1fr 140px 90px 90px 70px' }}
      >
        {/* Family -> Target */}
        <div className="flex items-center gap-2 py-2.5 pr-2 min-w-0">
          <ChevronRight className={cn('w-3.5 h-3.5 text-ink-3 shrink-0 transition-transform duration-120', expanded && 'rotate-90')} />
          <TypographyPreview
            properties={{ ...item.before, fontSize: Math.min(item.before.fontSize, 12) }}
            className="w-7 h-6 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink truncate">
              {item.before.fontFamily} {item.before.fontStyle} / {item.before.fontSize}px
              <span className="text-ink-3 mx-1">→</span>
              <span className={cn('font-medium',
                item.after.type === 'existing-style' ? 'text-accent'
                : item.after.type === 'existing-variable' ? 'text-warning'
                : item.after.type === 'new-style' ? 'text-success'
                : 'text-ink-2'
              )}>{item.after.displayName}</span>
            </p>
            <p className="text-2xs text-ink-3">{item.family.signatureCount} signatures</p>
          </div>
        </div>

        {/* Risk */}
        <div><RiskBadge risk={item.risk} /></div>

        {/* Layers */}
        <div className="text-xs tabular-nums text-ink-2 text-right">{item.affectedLayers.toLocaleString()}</div>

        {/* Changed properties */}
        <div className="text-right">
          {item.changedCount > 0 ? (
            <span className="text-xs text-warning font-medium">{item.changedCount} changed</span>
          ) : (
            <span className="text-2xs text-ink-disabled">no changes</span>
          )}
        </div>

        {/* Issues */}
        <div className="text-right">
          {hasIssues ? (
            <span className="flex items-center justify-end gap-1 text-xs text-warning">
              <AlertTriangle className="w-3 h-3" />{item.validationIssues.length}
            </span>
          ) : <span className="text-2xs text-ink-disabled">—</span>}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border-subtle bg-surface-0 px-5 py-4 space-y-4">
          {/* Validation issues */}
          {hasIssues && (
            <div className="space-y-1">
              {item.validationIssues.map((issue, i) => (
                <div key={i} className={cn('flex items-start gap-2 text-xs', issue.severity === 'error' ? 'text-danger' : 'text-warning')}>
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>{issue.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Before vs After */}
          <div>
            <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Before → After</p>
            <BeforeAfterTable changes={item.changes} />
            {item.after.type === 'existing-style' && (
              <p className="text-2xs text-ink-disabled mt-1">
                “Inherited” properties (line height, letter spacing, etc.) are defined by the text style
                and will be applied during migration.
              </p>
            )}
            {item.after.type === 'existing-variable' && (
              <p className="text-2xs text-ink-disabled mt-1">
                Variable values are resolved at apply time. Preview cannot show final values.
              </p>
            )}
          </div>

          {/* Impact */}
          <div>
            <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Impact</p>
            <div className="flex gap-4 text-xs">
              {([
                ['Layers',     item.affectedLayers],
                ['Pages',      item.affectedPages],
                ['Components', item.affectedComponents],
                ['Instances',  item.affectedInstances],
                ['Variants',   item.affectedVariants],
              ] as [string, number][]).map(([label, value]) => value > 0 && (
                <div key={label}>
                  <p className="text-ink-3">{label}</p>
                  <p className="font-semibold text-ink tabular-nums">{value.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Risk factors */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest">Risk</p>
              <RiskBadge risk={item.risk} />
            </div>
            <ul className="space-y-0.5">
              {item.riskFactors.map((rf, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-ink-2">
                  <span className="text-border-strong mt-0.5">•</span>
                  <span>{rf}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
