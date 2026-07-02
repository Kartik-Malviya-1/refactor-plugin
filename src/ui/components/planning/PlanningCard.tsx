import { useState, useMemo } from 'react'
import { ChevronRight, X, Check } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from '../ui/Button'
import { SearchInput } from '../ui/SearchInput'
import { TypographyPreview } from '../audit/TypographyPreview'
import { SuggestionRow, SuggestionPanel } from './SuggestionPanel'
import { useMigrationStore } from '../../store/migration'
import { usePlanningDataStore } from '../../store/planningData'
import { useSessionLearning } from '../../hooks/useSessionLearning'
import type { CandidateFamily } from '../../../similarity/types'
import type { SmartSuggestion } from '../../../suggestions/types'
import type {
  ConsolidationTarget, ConsolidationTargetType,
  ExistingStyleTarget, ExistingVariableTarget,
  NewStyleTarget, ManualValuesTarget, SkipTarget,
  PlanningStatus,
} from '../../../shared/migration'

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_STYLE: Record<PlanningStatus, string> = {
  'needs-review':         'bg-surface-active text-ink-3 border border-border',
  'suggestions-available': 'bg-accent-subtle text-accent border border-accent/20',
  'planned':              'bg-success-subtle text-success border border-success/20',
  'modified':             'bg-warning-subtle text-warning border border-warning/20',
  'skipped':              'bg-surface-0 text-ink-disabled border border-border',
}
const STATUS_LABEL: Record<PlanningStatus, string> = {
  'needs-review':         'Needs Review',
  'suggestions-available': 'Suggestions',
  'planned':              'Planned',
  'modified':             'Modified',
  'skipped':              'Skipped',
}

function TargetPreview({ target }: { target: ConsolidationTarget | null }) {
  if (!target) return <span className="text-xs text-ink-disabled">—</span>
  switch (target.type) {
    case 'existing-style':    return <span className="text-xs text-accent truncate max-w-[130px]">→ {target.styleName}</span>
    case 'existing-variable': return <span className="text-xs text-warning truncate max-w-[130px]">→ {target.variableName}</span>
    case 'new-style':         return <span className="text-xs text-success truncate max-w-[130px]">→ New: {target.name || '(unnamed)'}</span>
    case 'manual-values':     return <span className="text-xs text-ink-2">→ Manual</span>
    case 'skip':              return <span className="text-xs text-ink-disabled">× Skipped</span>
  }
}

// ---------------------------------------------------------------------------
// Inline typography form
// ---------------------------------------------------------------------------

interface TypoVals {
  name?: string; fontFamily: string; fontStyle: string; fontWeight: number; fontSize: number
  lineHeightUnit: 'AUTO'|'PIXELS'|'PERCENT'; lineHeightValue: number
  letterSpacingUnit: 'PIXELS'|'PERCENT'; letterSpacingValue: number
  textCase: string; textDecoration: string
}

function TypographyFormFields({ values, onChange, withName }: { values: TypoVals; onChange: (v: TypoVals) => void; withName: boolean }) {
  function field(label: string, el: React.ReactNode) {
    return <div className="flex items-center gap-2"><span className="text-xs text-ink-3 w-28 shrink-0">{label}</span><div className="flex-1">{el}</div></div>
  }
  const inp = (key: keyof TypoVals, type = 'text') => (
    <input type={type} value={String(values[key] ?? '')} onChange={e => onChange({ ...values, [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
      className="w-full h-6 px-2 text-xs bg-surface-0 border border-border rounded focus:outline-none focus:border-accent/60" />
  )
  const sel = (key: keyof TypoVals, opts: string[]) => (
    <select value={String(values[key] ?? '')} onChange={e => onChange({ ...values, [key]: e.target.value })}
      className="w-full h-6 px-1 text-xs bg-surface-0 border border-border rounded focus:outline-none">
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  return (
    <div className="space-y-2">
      {withName && field('Name', inp('name'))}
      {field('Font Family', inp('fontFamily'))}
      {field('Font Style', inp('fontStyle'))}
      {field('Font Weight', inp('fontWeight', 'number'))}
      {field('Font Size (px)', inp('fontSize', 'number'))}
      {field('Line Height', <div className="flex gap-1">{sel('lineHeightUnit',['AUTO','PIXELS','PERCENT'])}{values.lineHeightUnit !== 'AUTO' && inp('lineHeightValue','number')}</div>)}
      {field('Letter Spacing', <div className="flex gap-1">{sel('letterSpacingUnit',['PIXELS','PERCENT'])}{inp('letterSpacingValue','number')}</div>)}
      {field('Text Case', sel('textCase',['ORIGINAL','UPPER','LOWER','TITLE','SMALL_CAPS','SMALL_CAPS_FORCED']))}
      {field('Text Decoration', sel('textDecoration',['NONE','UNDERLINE','STRIKETHROUGH']))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main card
// ---------------------------------------------------------------------------

export function PlanningCard({
  family, entry, suggestions,
}: {
  family: CandidateFamily
  entry: { status: PlanningStatus; target: ConsolidationTarget | null; acceptedViaSuggestion?: boolean }
  suggestions: SmartSuggestion[]
}) {
  const { setTarget, clearTarget, setStatus } = useMigrationStore()
  const { textStyles, variables } = usePlanningDataStore()
  const { record } = useSessionLearning()

  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState<ConsolidationTargetType | null>(null)
  const [styleSearch, setStyleSearch] = useState('')
  const [varSearch, setVarSearch] = useState('')
  const [skipReason, setSkipReason] = useState('')
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  const defaultForm = useMemo<TypoVals>(() => ({
    name: '', fontFamily: family.dominant.fontFamily, fontStyle: family.dominant.fontStyle,
    fontWeight: family.dominant.fontWeight, fontSize: family.dominant.fontSize,
    lineHeightUnit: family.dominant.lineHeight.unit, lineHeightValue: family.dominant.lineHeight.value,
    letterSpacingUnit: family.dominant.letterSpacing.unit, letterSpacingValue: family.dominant.letterSpacing.value,
    textCase: family.dominant.textCase, textDecoration: family.dominant.textDecoration,
  }), [family.dominant])

  const [formValues, setFormValues] = useState<TypoVals>(defaultForm)

  const topSuggestion = suggestions.find(s => !dismissedIds.has(s.id))
  const showSuggestionRow = !!topSuggestion && entry.status !== 'planned' && entry.status !== 'modified' && entry.status !== 'skipped'

  const filteredStyles = useMemo(() => textStyles.filter(s => s.name.toLowerCase().includes(styleSearch.toLowerCase()) || s.fontFamily.toLowerCase().includes(styleSearch.toLowerCase())), [textStyles, styleSearch])
  const filteredVars   = useMemo(() => variables.filter(v => v.name.toLowerCase().includes(varSearch.toLowerCase()) || v.collectionName.toLowerCase().includes(varSearch.toLowerCase())), [variables, varSearch])

  function handleExpand() {
    setExpanded(!expanded)
    if (!expanded && entry.status === 'needs-review') setStatus(family.id, 'suggestions-available')
  }

  function acceptSuggestion(s: SmartSuggestion) {
    setTarget(family.id, s.target, 'suggestion')
    record({ familyId: family.id, target: s.target, dominantProps: family.dominant })
    setExpanded(false)
  }

  function dismissSuggestion(id: string) {
    setDismissedIds(prev => new Set([...prev, id]))
  }

  function confirmStyle(style: typeof textStyles[0]) {
    const t: ExistingStyleTarget = { type: 'existing-style', styleId: style.id, styleName: style.name, libraryName: style.libraryName, fontFamily: style.fontFamily, fontStyle: style.fontStyle, fontSize: style.fontSize }
    setTarget(family.id, t, 'manual'); setExpanded(false)
  }
  function confirmVariable(v: typeof variables[0]) {
    const t: ExistingVariableTarget = { type: 'existing-variable', variableId: v.id, variableName: v.name, collectionName: v.collectionName, resolvedType: v.resolvedType }
    setTarget(family.id, t, 'manual'); setExpanded(false)
  }
  function confirmNewStyle() {
    if (!formValues.name?.trim()) return
    const t: NewStyleTarget = { type: 'new-style', name: formValues.name!, fontFamily: formValues.fontFamily, fontStyle: formValues.fontStyle, fontWeight: formValues.fontWeight, fontSize: formValues.fontSize, lineHeightUnit: formValues.lineHeightUnit, lineHeightValue: formValues.lineHeightValue, letterSpacingUnit: formValues.letterSpacingUnit, letterSpacingValue: formValues.letterSpacingValue, textCase: formValues.textCase, textDecoration: formValues.textDecoration }
    setTarget(family.id, t, 'manual'); setExpanded(false)
  }
  function confirmManual() {
    const t: ManualValuesTarget = { type: 'manual-values', fontFamily: formValues.fontFamily, fontStyle: formValues.fontStyle, fontWeight: formValues.fontWeight, fontSize: formValues.fontSize, lineHeightUnit: formValues.lineHeightUnit, lineHeightValue: formValues.lineHeightValue, letterSpacingUnit: formValues.letterSpacingUnit, letterSpacingValue: formValues.letterSpacingValue, textCase: formValues.textCase, textDecoration: formValues.textDecoration }
    setTarget(family.id, t, 'manual'); setExpanded(false)
  }
  function confirmSkip() {
    const t: SkipTarget = { type: 'skip', reason: skipReason.trim() || undefined }
    setTarget(family.id, t, 'manual'); setExpanded(false)
  }

  const TABS: { id: ConsolidationTargetType; label: string }[] = [
    { id: 'existing-style', label: 'Style' }, { id: 'existing-variable', label: 'Variable' },
    { id: 'new-style', label: 'New Style' }, { id: 'manual-values', label: 'Manual' }, { id: 'skip', label: 'Skip' },
  ]

  return (
    <div className="border-b border-border-subtle">
      {/* Main row */}
      <div onClick={handleExpand} className="grid items-center cursor-pointer hover:bg-surface-hover transition-colors"
        style={{ gridTemplateColumns: '28px 1fr 115px 60px 1fr' }}>
        <div className="flex items-center justify-center h-10">
          <ChevronRight className={cn('w-3.5 h-3.5 text-ink-3 transition-transform duration-120', expanded && 'rotate-90')} />
        </div>
        <div className="flex items-center gap-2 py-2 pr-2 min-w-0">
          <TypographyPreview properties={{ ...family.dominant, fontSize: Math.min(family.dominant.fontSize, 12) }} className="w-7 h-6 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink truncate">{family.dominant.fontFamily} {family.dominant.fontStyle} / {family.dominant.fontSize}px</p>
            <p className="text-2xs text-ink-3">{family.totalLayers.toLocaleString()} layers · {family.signatureCount} sigs</p>
          </div>
        </div>
        <div><span className={cn('inline-flex px-1.5 py-0.5 rounded text-2xs font-medium', STATUS_STYLE[entry.status as PlanningStatus])}>{STATUS_LABEL[entry.status as PlanningStatus]}</span></div>
        <div className="text-xs text-ink-3 tabular-nums text-center">{family.confidence}%</div>
        <div className="pr-3"><TargetPreview target={entry.target} /></div>
      </div>

      {/* Suggestion sub-row (always visible if suggestions exist and family not planned) */}
      {showSuggestionRow && (
        <SuggestionRow
          suggestion={topSuggestion!}
          totalCount={suggestions.filter(s => !dismissedIds.has(s.id)).length}
          onAccept={() => acceptSuggestion(topSuggestion!)}
          onDismiss={() => dismissSuggestion(topSuggestion!.id)}
          onShowAll={() => { setExpanded(true) }}
        />
      )}

      {/* Expanded view */}
      {expanded && (
        <div className="border-t border-border-subtle bg-surface-0">
          {/* Family summary */}
          <div className="flex items-center gap-3 mx-4 mt-3 p-3 bg-surface-1 rounded border border-border text-xs">
            <div className="flex-1 space-y-0.5">
              <p><span className="text-ink-3 w-20 inline-block">Font</span><span className="font-medium text-ink">{family.dominant.fontFamily} {family.dominant.fontStyle} {family.dominant.fontSize}px</span></p>
              <p><span className="text-ink-3 w-20 inline-block">Confidence</span><span className="text-ink-2">{family.confidence}% {family.confidenceLabel}</span></p>
            </div>
            {entry.target && (
              <button onClick={() => clearTarget(family.id)} className="text-ink-3 hover:text-danger transition-colors" title="Clear target"><X className="w-3.5 h-3.5" /></button>
            )}
          </div>

          {/* Smart Suggestions */}
          {suggestions.length > 0 && (
            <SuggestionPanel
              suggestions={suggestions}
              dismissedIds={dismissedIds}
              onAccept={acceptSuggestion}
              onDismiss={dismissSuggestion}
            />
          )}

          {/* Manual target tabs */}
          <div className="mx-4 mb-3">
            <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Manual Target</p>
            <div className="flex border-b border-border mb-3">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setMode(tab.id)}
                  className={cn('px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors',
                    mode === tab.id ? 'border-accent text-accent' : 'border-transparent text-ink-3 hover:text-ink')}
                >{tab.label}</button>
              ))}
            </div>

            {mode === 'existing-style' && (
              <div className="space-y-2">
                <SearchInput value={styleSearch} onChange={setStyleSearch} placeholder="Search styles…" />
                {textStyles.length === 0 ? <p className="text-xs text-ink-disabled py-3 text-center">No local text styles found.</p> : (
                  <div className="max-h-40 overflow-y-auto space-y-0.5">
                    {filteredStyles.map(style => (
                      <button key={style.id} onClick={() => confirmStyle(style)}
                        className="w-full flex items-center gap-3 px-2 py-1.5 rounded hover:bg-surface-hover transition-colors text-left">
                        <div className="flex-1 min-w-0"><p className="text-xs font-medium text-ink truncate">{style.name}</p><p className="text-2xs text-ink-3">{style.fontFamily} {style.fontStyle} / {style.fontSize}px</p></div>
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
                {variables.length === 0 ? <p className="text-xs text-ink-disabled py-3 text-center">No local variables found.</p> : (
                  <div className="max-h-40 overflow-y-auto space-y-0.5">
                    {filteredVars.map(v => (
                      <button key={v.id} onClick={() => confirmVariable(v)}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-surface-hover transition-colors text-left gap-2">
                        <div className="min-w-0"><p className="text-xs font-medium text-ink truncate">{v.name}</p><p className="text-2xs text-ink-3">{v.collectionName} · {v.resolvedType}</p></div>
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
                <Button variant="primary" size="sm" disabled={!formValues.name?.trim()} onClick={confirmNewStyle}>Set as Planned Style</Button>
              </div>
            )}
            {mode === 'manual-values' && (
              <div className="space-y-3">
                <TypographyFormFields values={formValues} onChange={setFormValues} withName={false} />
                <Button variant="primary" size="sm" onClick={confirmManual}>Set Manual Values</Button>
              </div>
            )}
            {mode === 'skip' && (
              <div className="space-y-3">
                <p className="text-xs text-ink-3">This family will be excluded from migration. You can change this at any time.</p>
                <input type="text" value={skipReason} onChange={e => setSkipReason(e.target.value)} placeholder="Reason (optional)"
                  className="w-full h-7 px-2 text-xs bg-surface-1 border border-border rounded focus:outline-none focus:border-accent/60" />
                <Button variant="secondary" size="sm" onClick={confirmSkip}>Skip This Family</Button>
              </div>
            )}
            {!mode && <p className="text-xs text-ink-disabled text-center py-3">Select a target type above to plan manually.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
