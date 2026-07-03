import { useState, useMemo, useEffect } from 'react'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import { SearchInput } from '../ui/SearchInput'
import { useAssignmentStore } from '../../store/assignment'
import { usePlanningDataStore } from '../../store/planningData'
import { sendToPlugin } from '../../hooks/useSendMessage'
import type { TypographyProperties } from '../../../modules/typography/types'
import type {
  ExistingStyleTarget, ExistingVariableTarget,
  NewStyleTarget, NewVariableTarget,
  ManualValuesTarget, SkipTarget,
  ConsolidationTargetType,
} from '../../../shared/migration'
import type { AssignedTarget } from '../../../clustering/types'

interface AssignmentPanelProps {
  selectedIds:  string[]
  clusterId:    string
  dominant:     TypographyProperties
  onClose?:     () => void
  initialMode?: ConsolidationTargetType
}

function TypoFormFields({ values, onChange, withName, namePlaceholder }: {
  values: Record<string, unknown>; onChange: (k: string, v: unknown) => void
  withName: boolean; namePlaceholder?: string
}) {
  const row = (label: string, el: React.ReactNode) => (
    <div className="flex items-center gap-2">
      <span className="text-xs text-ink-3 w-28 shrink-0">{label}</span>
      <div className="flex-1">{el}</div>
    </div>
  )
  const inp = (key: string, type = 'text') => (
    <input type={type} value={String(values[key]??'')} onChange={e=>onChange(key,type==='number'?Number(e.target.value):e.target.value)}
      className="w-full h-6 px-2 text-xs bg-surface-0 border border-border rounded focus:outline-none focus:border-accent/60" />
  )
  const sel = (key: string, opts: string[]) => (
    <select value={String(values[key]??'')} onChange={e=>onChange(key,e.target.value)}
      className="w-full h-6 px-1 text-xs bg-surface-0 border border-border rounded focus:outline-none">
      {opts.map(o=><option key={o} value={o}>{o}</option>)}
    </select>
  )
  return (
    <div className="space-y-1.5">
      {withName && row(namePlaceholder??'Name', inp('name'))}
      {row('Font Family', inp('fontFamily'))}
      {row('Font Style', inp('fontStyle'))}
      {row('Font Weight', inp('fontWeight','number'))}
      {row('Font Size (px)', inp('fontSize','number'))}
      {row('Line Height', <div className="flex gap-1">{sel('lineHeightUnit',['AUTO','PIXELS','PERCENT'])}{(values.lineHeightUnit as string)!=='AUTO'&&inp('lineHeightValue','number')}</div>)}
      {row('Letter Spacing', <div className="flex gap-1">{sel('letterSpacingUnit',['PIXELS','PERCENT'])}{inp('letterSpacingValue','number')}</div>)}
      {row('Text Case', sel('textCase',['ORIGINAL','UPPER','LOWER','TITLE','SMALL_CAPS','SMALL_CAPS_FORCED']))}
      {row('Text Decoration', sel('textDecoration',['NONE','UNDERLINE','STRIKETHROUGH']))}
    </div>
  )
}

const TABS: { id: ConsolidationTargetType; label: string }[] = [
  { id: 'existing-style',    label: 'Style'        },
  { id: 'existing-variable', label: 'Variable'     },
  { id: 'new-style',         label: 'New Style'    },
  { id: 'new-variable',      label: 'New Variable' },
  { id: 'manual-values',     label: 'Manual'       },
  { id: 'skip',              label: 'Skip'         },
]

export function AssignmentPanel({ selectedIds, dominant, onClose, initialMode }: AssignmentPanelProps) {
  const { assign } = useAssignmentStore()
  const { textStyles, variables, loaded, loading, setLoading } = usePlanningDataStore()

  const [mode, setMode] = useState<ConsolidationTargetType | null>(initialMode ?? null)
  const [styleSearch, setStyleSearch] = useState('')
  const [varSearch,   setVarSearch]   = useState('')
  const [skipReason,  setSkipReason]  = useState('')
  const [form, setForm] = useState<Record<string,unknown>>({
    name:'', collectionName:'',
    fontFamily: dominant.fontFamily, fontStyle: dominant.fontStyle,
    fontWeight: dominant.fontWeight, fontSize: dominant.fontSize,
    lineHeightUnit: dominant.lineHeight.unit, lineHeightValue: dominant.lineHeight.value,
    letterSpacingUnit: dominant.letterSpacing.unit, letterSpacingValue: dominant.letterSpacing.value,
    textCase: dominant.textCase, textDecoration: dominant.textDecoration,
  })

  // Request planning data if not yet loaded
  useEffect(() => {
    console.log('[TRACE UI] AssignmentPanel mount/update: loaded=', loaded, 'loading=', loading, 'textStyles.length=', textStyles.length)
    if (!loaded && !loading) {
      console.log('[TRACE UI] Requesting GET_PLANNING_DATA...')
      setLoading(true)
      sendToPlugin({ type: 'GET_PLANNING_DATA' })
    }
  }, [loaded, loading, setLoading])

  // Log store snapshot every time textStyles changes
  useEffect(() => {
    const localCount   = textStyles.filter(s => s.isLocal).length
    const libraryCount = textStyles.filter(s => !s.isLocal).length
    console.log('[TRACE UI] Store snapshot — total:', textStyles.length, 'local:', localCount, 'library:', libraryCount, 'loaded:', loaded, 'loading:', loading)
    if (textStyles.length > 0) {
      console.log('[TRACE UI] First 5 store objects:', JSON.stringify(textStyles.slice(0,5)))
    }
  }, [textStyles, loaded, loading])

  const filteredStyles = useMemo(() => {
    console.log('[TRACE UI] filteredStyles memo — input textStyles.length:', textStyles.length, 'styleSearch:', JSON.stringify(styleSearch))

    const result = textStyles.filter(s => {
      const nameMatch   = s.name.toLowerCase().includes(styleSearch.toLowerCase())
      const familyMatch = s.fontFamily.toLowerCase().includes(styleSearch.toLowerCase())
      const passes = nameMatch || familyMatch
      if (!passes) {
        console.log('[TRACE UI] FILTERED OUT:', JSON.stringify(s), 'search:', styleSearch)
      }
      return passes
    })

    console.log('[TRACE UI] filteredStyles result:', result.length, 'of', textStyles.length)
    if (result.length > 0) {
      console.log('[TRACE UI] filteredStyles first 5:', JSON.stringify(result.slice(0,5)))
    }
    return result
  }, [textStyles, styleSearch])

  const filteredVars = useMemo(() =>
    variables.filter(v => v.name.toLowerCase().includes(varSearch.toLowerCase())),
    [variables, varSearch]
  )

  function doAssign(target: AssignedTarget) {
    if (selectedIds.length === 0) { console.warn('[TRACE UI] Assignment skipped: no signatures selected'); return }
    assign(selectedIds, target)
    onClose?.()
  }
  function setField(k: string, v: unknown) { setForm(f => ({...f,[k]:v})) }

  function assignStyle(style: (typeof textStyles)[0]) {
    const t: ExistingStyleTarget = { type:'existing-style', styleId:style.id, styleName:style.name, libraryName:style.libraryName, fontFamily:style.fontFamily, fontStyle:style.fontStyle, fontSize:style.fontSize }
    doAssign({ label: style.name, target: t })
  }
  function assignVariable(v: (typeof variables)[0]) {
    const t: ExistingVariableTarget = { type:'existing-variable', variableId:v.id, variableName:v.name, collectionName:v.collectionName, resolvedType:v.resolvedType }
    doAssign({ label: v.name, target: t })
  }
  function assignNewStyle() {
    if (!String(form.name||'').trim()) return
    const t: NewStyleTarget = { type:'new-style', name:String(form.name), fontFamily:String(form.fontFamily), fontStyle:String(form.fontStyle), fontWeight:Number(form.fontWeight), fontSize:Number(form.fontSize), lineHeightUnit:form.lineHeightUnit as 'AUTO', lineHeightValue:Number(form.lineHeightValue), letterSpacingUnit:form.letterSpacingUnit as 'PIXELS', letterSpacingValue:Number(form.letterSpacingValue), textCase:String(form.textCase), textDecoration:String(form.textDecoration) }
    doAssign({ label:`New: ${t.name}`, target:t })
  }
  function assignNewVariable() {
    if (!String(form.name||'').trim()) return
    const t: NewVariableTarget = { type:'new-variable', variableName:String(form.name), collectionName:String(form.collectionName||''), fontFamily:String(form.fontFamily), fontStyle:String(form.fontStyle), fontWeight:Number(form.fontWeight), fontSize:Number(form.fontSize), lineHeightUnit:form.lineHeightUnit as 'AUTO', lineHeightValue:Number(form.lineHeightValue), letterSpacingUnit:form.letterSpacingUnit as 'PIXELS', letterSpacingValue:Number(form.letterSpacingValue), textCase:String(form.textCase), textDecoration:String(form.textDecoration) }
    doAssign({ label:`Variable: ${t.variableName}`, target:t })
  }
  function assignManual() {
    const t: ManualValuesTarget = { type:'manual-values', fontFamily:String(form.fontFamily), fontStyle:String(form.fontStyle), fontWeight:Number(form.fontWeight), fontSize:Number(form.fontSize), lineHeightUnit:form.lineHeightUnit as 'AUTO', lineHeightValue:Number(form.lineHeightValue), letterSpacingUnit:form.letterSpacingUnit as 'PIXELS', letterSpacingValue:Number(form.letterSpacingValue), textCase:String(form.textCase), textDecoration:String(form.textDecoration) }
    doAssign({ label:'Manual Values', target:t })
  }
  function assignSkip() {
    const t: SkipTarget = { type:'skip', reason:skipReason.trim()||undefined }
    doAssign({ label:'Skipped', target:t })
  }

  const count = selectedIds.length
  const countLabel = count === 0 ? 'No signatures selected' : `${count} signature${count!==1?'s':''} selected`

  return (
    <div className="bg-surface-0 border-t border-border-subtle">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-subtle">
        <span className="text-2xs text-ink-3 flex-1">{countLabel}</span>
        {loading && <Loader2 className="w-3 h-3 text-ink-3 animate-spin shrink-0" />}
      </div>
      <div className="flex border-b border-border">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setMode(tab.id)}
            className={`px-2.5 py-1.5 text-2xs font-medium border-b-2 -mb-px transition-colors ${
              mode===tab.id ? 'border-accent text-accent' : 'border-transparent text-ink-3 hover:text-ink'
            }`}>{tab.label}</button>
        ))}
      </div>
      <div className="p-3 max-h-56 overflow-y-auto">
        {loading && (
          <div className="flex items-center gap-2 py-4 text-xs text-ink-3 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />Loading styles and variables…
          </div>
        )}
        {!loading && !mode && <p className="text-xs text-ink-disabled text-center py-3">Choose an assignment type above.</p>}

        {!loading && mode==='existing-style' && (
          <div className="space-y-2">
            <SearchInput value={styleSearch} onChange={setStyleSearch} placeholder="Search styles…" />
            {textStyles.length === 0 ? (
              <div className="flex items-start gap-2 py-3">
                <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-ink">No text styles found</p>
                  <p className="text-xs text-ink-3 mt-0.5 leading-relaxed">
                    Run a scan first so Refactor can discover which styles are used in this file.
                    Local and library styles will both appear here after scanning.
                  </p>
                </div>
              </div>
            ) : filteredStyles.length === 0 ? (
              <p className="text-xs text-ink-disabled py-2 text-center">No styles match “{styleSearch}”</p>
            ) : (
              <div className="space-y-0.5">
                {filteredStyles.map(style => (
                  <button key={style.id} onClick={()=>assignStyle(style)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-hover text-left">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-ink truncate">{style.name}</p>
                      <p className="text-2xs text-ink-3">{style.fontFamily} {style.fontStyle} / {style.fontSize}px{style.libraryName?` · ${style.libraryName}`:''}{!style.isLocal?' · Library':''}</p>
                    </div>
                    <Check className="w-3 h-3 text-ink-disabled shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && mode==='existing-variable' && (
          <div className="space-y-2">
            <SearchInput value={varSearch} onChange={setVarSearch} placeholder="Search variables…" />
            {variables.length === 0 ? (
              <div className="flex items-start gap-2 py-3">
                <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-ink">No variables found</p>
                  <p className="text-xs text-ink-3 mt-0.5">No local STRING or FLOAT variables were found in this file.</p>
                </div>
              </div>
            ) : filteredVars.length === 0 ? (
              <p className="text-xs text-ink-disabled py-2 text-center">No variables match “{varSearch}”</p>
            ) : (
              <div className="space-y-0.5">
                {filteredVars.map(v => (
                  <button key={v.id} onClick={()=>assignVariable(v)}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-surface-hover text-left">
                    <div className="min-w-0"><p className="text-xs font-medium text-ink truncate">{v.name}</p><p className="text-2xs text-ink-3">{v.collectionName} · {v.resolvedType}</p></div>
                    <Check className="w-3 h-3 text-ink-disabled shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && mode==='new-style' && (
          <div className="space-y-2">
            <TypoFormFields values={form} onChange={setField} withName namePlaceholder="Style Name" />
            <button onClick={assignNewStyle} disabled={!String(form.name||'').trim()}
              className="w-full h-7 rounded bg-accent text-accent-fg text-xs font-medium disabled:opacity-40 hover:bg-accent-hover transition-colors">Plan New Style</button>
          </div>
        )}
        {!loading && mode==='new-variable' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1"><label className="text-2xs text-ink-3">Variable Name</label><input value={String(form.name||'')} onChange={e=>setField('name',e.target.value)} className="w-full h-6 px-2 text-xs bg-surface-0 border border-border rounded focus:outline-none mt-0.5" /></div>
              <div className="flex-1"><label className="text-2xs text-ink-3">Collection</label><input value={String(form.collectionName||'')} onChange={e=>setField('collectionName',e.target.value)} className="w-full h-6 px-2 text-xs bg-surface-0 border border-border rounded focus:outline-none mt-0.5" /></div>
            </div>
            <TypoFormFields values={form} onChange={setField} withName={false} />
            <button onClick={assignNewVariable} disabled={!String(form.name||'').trim()}
              className="w-full h-7 rounded bg-accent text-accent-fg text-xs font-medium disabled:opacity-40 hover:bg-accent-hover transition-colors">Plan New Variable</button>
          </div>
        )}
        {!loading && mode==='manual-values' && (
          <div className="space-y-2">
            <TypoFormFields values={form} onChange={setField} withName={false} />
            <button onClick={assignManual} className="w-full h-7 rounded bg-accent text-accent-fg text-xs font-medium hover:bg-accent-hover transition-colors">Assign Manual Values</button>
          </div>
        )}
        {!loading && mode==='skip' && (
          <div className="space-y-2">
            <p className="text-xs text-ink-3">These signatures will be excluded from migration.</p>
            <input type="text" value={skipReason} onChange={e=>setSkipReason(e.target.value)} placeholder="Reason (optional)" className="w-full h-6 px-2 text-xs bg-surface-1 border border-border rounded focus:outline-none" />
            <button onClick={assignSkip} className="w-full h-7 rounded border border-border text-xs text-ink-2 hover:border-border-strong transition-colors">Skip Selected Signatures</button>
          </div>
        )}
      </div>
    </div>
  )
}
