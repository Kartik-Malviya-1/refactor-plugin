import { useState, useMemo } from 'react'
import { ChevronRight, X, Check } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from '../ui/Button'
import { SearchInput } from '../ui/SearchInput'
import { TypographyPreview } from '../audit/TypographyPreview'
import { useMigrationStore } from '../../store/migration'
import { usePlanningDataStore } from '../../store/planningData'
import type { CandidateFamily } from '../../../similarity/types'
import type {
  ConsolidationTarget, ConsolidationTargetType,
  ExistingStyleTarget, ExistingVariableTarget,
  NewStyleTarget, ManualValuesTarget, SkipTarget,
} from '../../../shared/migration'
import type { PlanningStatus } from '../../../shared/migration'

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_STYLE: Record<PlanningStatus, string> = {
  unreviewed:  'bg-surface-active text-ink-3 border border-border',
  'in-progress': 'bg-warning-subtle text-warning border border-warning/20',
  planned:     'bg-success-subtle text-success border border-success/20',
  skipped:     'bg-surface-0 text-ink-disabled border border-border',
}
const STATUS_LABEL: Record<PlanningStatus, string> = {
  unreviewed:    'Unreviewed',
  'in-progress': 'In Progress',
  planned:       'Planned',
  skipped:       'Skipped',
}

function StatusBadge({ status }: { status: PlanningStatus }) {
  return (
    <span className={cn('inline-flex px-1.5 py-0.5 rounded text-2xs font-medium', STATUS_STYLE[status])}>
      {STATUS_LABEL[status]}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Target preview (collapsed view)
// ---------------------------------------------------------------------------

function TargetPreview({ target }: { target: ConsolidationTarget | null }) {
  if (!target) return <span className="text-xs text-ink-disabled">—</span>
  switch (target.type) {
    case 'existing-style':   return <span className="text-xs text-accent truncate max-w-[120px]">→ {target.styleName}</span>
    case 'existing-variable': return <span className="text-xs text-warning truncate max-w-[120px]">→ {target.variableName}</span>
    case 'new-style':        return <span className="text-xs text-success truncate max-w-[120px]">→ New: {target.name}</span>
    case 'manual-values':    return <span className="text-xs text-ink-2">→ Manual values</span>
    case 'skip':             return <span className="text-xs text-ink-disabled">× Skipped</span>
  }
}

// ---------------------------------------------------------------------------
// Inline typography form (used for New Style + Manual Values)
// ---------------------------------------------------------------------------

interface TypoFormValues {
  name?: string
  fontFamily: string; fontStyle: string; fontWeight: number; fontSize: number
  lineHeightUnit: 'AUTO' | 'PIXELS' | 'PERCENT'; lineHeightValue: number
  letterSpacingUnit: 'PIXELS' | 'PERCENT'; letterSpacingValue: number
  textCase: string; textDecoration: string
}

function TypographyFormFields({
  values, onChange, withName,
}: {
  values: TypoFormValues
  onChange: (v: TypoFormValues) => void
  withName: boolean
}) {
  function field(label: string, content: React.ReactNode) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-3 w-28 shrink-0">{label}</span>
        <div className="flex-1">{content}</div>
      </div>
    )
  }
  const inp = (key: keyof TypoFormValues, type = 'text') => (
    <input
      type={type}
      value={String(values[key] ?? '')}
      onChange={(e) => onChange({ ...values, [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
      className="w-full h-6 px-2 text-xs bg-surface-0 border border-border rounded focus:outline-none focus:border-accent/60"
    />
  )
  const sel = (key: keyof TypoFormValues, options: string[]) => (
    <select
      value={String(values[key] ?? '')}
      onChange={(e) => onChange({ ...values, [key]: e.target.value })}
      className="w-full h-6 px-1 text-xs bg-surface-0 border border-border rounded focus:outline-none"
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  return (
    <div className="space-y-2">
      {withName && field('Name', inp('name'))}
      {field('Font Family', inp('fontFamily'))}
      {field('Font Style', inp('fontStyle'))}
      {field('Font Weight', inp('fontWeight', 'number'))}
      {field('Font Size (px)', inp('fontSize', 'number'))}
      {field('Line Height', (
        <div className="flex gap-1">
          {sel('lineHeightUnit', ['AUTO', 'PIXELS', 'PERCENT'])}
          {values.lineHeightUnit !== 'AUTO' && inp('lineHeightValue', 'number')}
        </div>
      ))}
      {field('Letter Spacing', (
        <div className="flex gap-1">
          {sel('letterSpacingUnit', ['PIXELS', 'PERCENT'])}
          {inp('letterSpacingValue', 'number')}
        </div>
      ))}
      {field('Text Case', sel('textCase', ['ORIGINAL','UPPER','LOWER','TITLE','SMALL_CAPS','SMALL_CAPS_FORCED']))}
      {field('Text Decoration', sel('textDecoration', ['NONE','UNDERLINE','STRIKETHROUGH']))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main PlanningCard
// ---------------------------------------------------------------------------

interface PlanningCardProps {
  family: CandidateFamily
  entry: { status: PlanningStatus; target: ConsolidationTarget | null }
}

export function PlanningCard({ family, entry }: PlanningCardProps) {
  const { setTarget, clearTarget, setStatus } = useMigrationStore()
  const { textStyles, variables } = usePlanningDataStore()

  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState<ConsolidationTargetType | null>(null)
  const [styleSearch, setStyleSearch] = useState('')
  const [varSearch, setVarSearch] = useState('')
  const [skipReason, setSkipReason] = useState('')

  // Pre-populate form from dominant properties
  const defaultFormValues = useMemo<TypoFormValues>(() => ({
    name: '',
    fontFamily:         family.dominant.fontFamily,
    fontStyle:          family.dominant.fontStyle,
    fontWeight:         family.dominant.fontWeight,
    fontSize:           family.dominant.fontSize,
    lineHeightUnit:     family.dominant.lineHeight.unit,
    lineHeightValue:    family.dominant.lineHeight.value,
    letterSpacingUnit:  family.dominant.letterSpacing.unit,
    letterSpacingValue: family.dominant.letterSpacing.value,
    textCase:           family.dominant.textCase,
    textDecoration:     family.dominant.textDecoration,
  }), [family.dominant])

  const [formValues, setFormValues] = useState<TypoFormValues>(defaultFormValues)

  const filteredStyles = useMemo(() =>
    textStyles.filter(s =>
      s.name.toLowerCase().includes(styleSearch.toLowerCase()) ||
      s.fontFamily.toLowerCase().includes(styleSearch.toLowerCase())
    ),
    [textStyles, styleSearch]
  )

  const filteredVars = useMemo(() =>
    variables.filter(v =>
      v.name.toLowerCase().includes(varSearch.toLowerCase()) ||
      v.collectionName.toLowerCase().includes(varSearch.toLowerCase())
    ),
    [variables, varSearch]
  )

  function handleExpand() {
    setExpanded(!expanded)
    if (!expanded && entry.status === 'unreviewed') {
      setStatus(family.id, 'in-progress')
    }
  }

  function handleConfirmStyle(style: (typeof textStyles)[0]) {
    const target: ExistingStyleTarget = {
      type: 'existing-style',
      styleId: style.id,
      styleName: style.name,
      libraryName: style.libraryName,
      fontFamily: style.fontFamily,
      fontStyle: style.fontStyle,
      fontSize: style.fontSize,
    }
    setTarget(family.id, target)
    setExpanded(false)
  }

  function handleConfirmVariable(v: (typeof variables)[0]) {
    const target: ExistingVariableTarget = {
      type: 'existing-variable',
      variableId: v.id,
      variableName: v.name,
      collectionName: v.collectionName,
      resolvedType: v.resolvedType,
    }
    setTarget(family.id, target)
    setExpanded(false)
  }

  function handleConfirmNewStyle() {
    if (!formValues.name?.trim()) return
    const target: NewStyleTarget = {
      type: 'new-style',
      name: formValues.name!,
      fontFamily: formValues.fontFamily,
      fontStyle: formValues.fontStyle,
      fontWeight: formValues.fontWeight,
      fontSize: formValues.fontSize,
      lineHeightUnit: formValues.lineHeightUnit,
      lineHeightValue: formValues.lineHeightValue,
      letterSpacingUnit: formValues.letterSpacingUnit,
      letterSpacingValue: formValues.letterSpacingValue,
      textCase: formValues.textCase,
      textDecoration: formValues.textDecoration,
    }
    setTarget(family.id, target)
    setExpanded(false)
  }

  function handleConfirmManual() {
    const target: ManualValuesTarget = {
      type: 'manual-values',
      fontFamily: formValues.fontFamily,
      fontStyle: formValues.fontStyle,
      fontWeight: formValues.fontWeight,
      fontSize: formValues.fontSize,
      lineHeightUnit: formValues.lineHeightUnit,
      lineHeightValue: formValues.lineHeightValue,
      letterSpacingUnit: formValues.letterSpacingUnit,
      letterSpacingValue: formValues.letterSpacingValue,
      textCase: formValues.textCase,
      textDecoration: formValues.textDecoration,
    }
    setTarget(family.id, target)
    setExpanded(false)
  }

  function handleSkip() {
    const target: SkipTarget = { type: 'skip', reason: skipReason.trim() || undefined }
    setTarget(family.id, target)
    setExpanded(false)
  }

  const TABS: { id: ConsolidationTargetType; label: string }[] = [
    { id: 'existing-style',    label: 'Style' },
    { id: 'existing-variable', label: 'Variable' },
    { id: 'new-style',         label: 'New Style' },
    { id: 'manual-values',     label: 'Manual' },
    { id: 'skip',              label: 'Skip' },
  ]

  return (
    <div className="border-b border-border-subtle">
      {/* Collapsed row */}
      <div
        onClick={handleExpand}
        className="grid items-center cursor-pointer hover:bg-surface-hover transition-colors"
        style={{ gridTemplateColumns: '28px 1fr 100px 70px 1fr' }}
      >
        <div className="flex items-center justify-center h-10">
          <ChevronRight className={cn('w-3.5 h-3.5 text-ink-3 transition-transform duration-120', expanded && 'rotate-90')} />
        </div>
        <div className="flex items-center gap-2 py-2 pr-2 min-w-0">
          <TypographyPreview
            properties={{ ...family.dominant, fontSize: Math.min(family.dominant.fontSize, 12) }}
            className="w-7 h-6 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink truncate">
              {family.dominant.fontFamily} {family.dominant.fontStyle} / {family.dominant.fontSize}px
            </p>
            <p className="text-2xs text-ink-3">{family.totalLayers.toLocaleString()} layers · {family.signatureCount} sigs</p>
          </div>
        </div>
        <div><StatusBadge status={entry.status} /></div>
        <div className="text-xs text-ink-3 tabular-nums text-center">{family.confidence}%</div>
        <div className="pr-3"><TargetPreview target={entry.target} /></div>
      </div>

      {/* Expanded target selection */}
      {expanded && (
        <div className="border-t border-border-subtle bg-surface-0 p-4 space-y-4">
          {/* Family summary */}
          <div className="flex items-center gap-3 p-3 bg-surface-1 rounded border border-border text-xs">
            <div className="flex-1 space-y-0.5">
              <p><span className="text-ink-3 w-24 inline-block">Font</span> <span className="font-medium text-ink">{family.dominant.fontFamily} {family.dominant.fontStyle} {family.dominant.fontSize}px</span></p>
              <p><span className="text-ink-3 w-24 inline-block">Line Height</span> <span className="text-ink-2">{family.dominant.lineHeight.unit === 'AUTO' ? 'Auto' : `${family.dominant.lineHeight.value}${family.dominant.lineHeight.unit === 'PERCENT' ? '%' : 'px'}`}</span></p>
            </div>
            <div className="flex-1 space-y-0.5">
              <p><span className="text-ink-3 w-24 inline-block">Confidence</span> <span className="text-ink-2">{family.confidence}% {family.confidenceLabel}</span></p>
              <p><span className="text-ink-3 w-24 inline-block">Source</span> <span className="text-ink-2">{Object.keys(family.sourceBreakdown).join(', ') || 'Unknown'}</span></p>
            </div>
            {entry.target && (
              <button onClick={() => clearTarget(family.id)} className="text-ink-3 hover:text-danger transition-colors" title="Clear target">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mode tabs */}
          <div>
            <div className="flex border-b border-border mb-3">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setMode(tab.id)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors',
                    mode === tab.id
                      ? 'border-accent text-accent'
                      : 'border-transparent text-ink-3 hover:text-ink'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {mode === 'existing-style' && (
              <div className="space-y-2">
                <SearchInput value={styleSearch} onChange={setStyleSearch} placeholder="Search styles…" />
                {textStyles.length === 0 ? (
                  <p className="text-xs text-ink-disabled py-4 text-center">No local text styles found.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {filteredStyles.map(style => (
                      <button
                        key={style.id}
                        onClick={() => handleConfirmStyle(style)}
                        className="w-full flex items-center gap-3 px-2 py-1.5 rounded hover:bg-surface-hover transition-colors text-left"
                      >
                        <TypographyPreview
                          properties={{ fontFamily: style.fontFamily, fontStyle: style.fontStyle, fontWeight: 400, fontSize: Math.min(style.fontSize, 13), lineHeight: { unit: 'AUTO', value: 0 }, letterSpacing: { unit: 'PIXELS', value: 0 }, textCase: 'ORIGINAL', textDecoration: 'NONE' }}
                          className="w-8 h-6 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-ink truncate">{style.name}</p>
                          <p className="text-2xs text-ink-3">{style.fontFamily} {style.fontStyle} / {style.fontSize}px{style.libraryName ? ` · ${style.libraryName}` : ''}</p>
                        </div>
                        <Check className="w-3 h-3 text-ink-disabled shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {mode === 'existing-variable' && (
              <div className="space-y-2">
                <SearchInput value={varSearch} onChange={setVarSearch} placeholder="Search variables…" />
                {variables.length === 0 ? (
                  <p className="text-xs text-ink-disabled py-4 text-center">No local variables found.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {filteredVars.map(v => (
                      <button
                        key={v.id}
                        onClick={() => handleConfirmVariable(v)}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-surface-hover transition-colors text-left gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-ink truncate">{v.name}</p>
                          <p className="text-2xs text-ink-3">{v.collectionName} · {v.resolvedType}</p>
                        </div>
                        <Check className="w-3 h-3 text-ink-disabled shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {mode === 'new-style' && (
              <div className="space-y-3">
                <TypographyFormFields values={formValues} onChange={setFormValues} withName />
                <Button
                  variant="primary" size="sm"
                  disabled={!formValues.name?.trim()}
                  onClick={handleConfirmNewStyle}
                >
                  Set as Planned Style
                </Button>
              </div>
            )}

            {mode === 'manual-values' && (
              <div className="space-y-3">
                <TypographyFormFields values={formValues} onChange={setFormValues} withName={false} />
                <Button variant="primary" size="sm" onClick={handleConfirmManual}>
                  Set Manual Values
                </Button>
              </div>
            )}

            {mode === 'skip' && (
              <div className="space-y-3">
                <p className="text-xs text-ink-3">This family will be excluded from migration. You can change this at any time.</p>
                <div>
                  <label className="text-xs text-ink-3 mb-1 block">Reason (optional)</label>
                  <input
                    type="text"
                    value={skipReason}
                    onChange={(e) => setSkipReason(e.target.value)}
                    placeholder="e.g. Legacy, deprecated, no longer used"
                    className="w-full h-7 px-2 text-xs bg-surface-1 border border-border rounded focus:outline-none focus:border-accent/60"
                  />
                </div>
                <Button variant="secondary" size="sm" onClick={handleSkip}>
                  Skip This Family
                </Button>
              </div>
            )}

            {!mode && (
              <p className="text-xs text-ink-disabled text-center py-4">
                Select a target type above to begin planning this family.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
