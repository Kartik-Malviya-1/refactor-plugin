import type { CandidateFamily } from '../similarity/types'
import type { MigrationEntry, ConsolidationTarget, ExistingStyleTarget, NewStyleTarget, ManualValuesTarget, ExistingVariableTarget } from '../shared/migration'
import type { AvailableTextStyle, AvailableTypographyVariable } from '../shared/migration'
import type { TypographyProperties } from '../modules/typography/types'
import type { PreviewItem, ResolvedTarget, PropertyChange, RiskLevel, Conflict } from './types'

// ---------------------------------------------------------------------------
// Risk thresholds (configurable)
// ---------------------------------------------------------------------------

const RISK = {
  LAYERS_VERY_HIGH: 5_000,
  LAYERS_HIGH:      1_000,
  LAYERS_MEDIUM:      200,
  COMPS_HIGH:         500,
  COMPS_MEDIUM:       100,
  SCORE_VERY_HIGH:     50,
  SCORE_HIGH:          30,
  SCORE_MEDIUM:        15,
} as const

// ---------------------------------------------------------------------------
// Target resolution
// ---------------------------------------------------------------------------

export function resolveTarget(
  target: ConsolidationTarget,
  styleMap: Map<string, AvailableTextStyle>,
  _varMap: Map<string, AvailableTypographyVariable>
): ResolvedTarget {
  switch (target.type) {
    case 'existing-style': {
      const t = target as ExistingStyleTarget
      const style = styleMap.get(t.styleId)
      return {
        type: 'existing-style',
        displayName: t.styleName,
        fontFamily: style?.fontFamily ?? t.fontFamily,
        fontStyle:  style?.fontStyle  ?? t.fontStyle,
        fontSize:   style?.fontSize   ?? t.fontSize,
        // lineHeight/letterSpacing/textCase/textDecoration not available in AvailableTextStyle
      }
    }
    case 'new-style': {
      const t = target as NewStyleTarget
      return {
        type: 'new-style',
        displayName: t.name ? `New: ${t.name}` : 'New Style (unnamed)',
        fontFamily:         t.fontFamily,
        fontStyle:          t.fontStyle,
        fontWeight:         t.fontWeight,
        fontSize:           t.fontSize,
        lineHeightUnit:     t.lineHeightUnit,
        lineHeightValue:    t.lineHeightValue,
        letterSpacingUnit:  t.letterSpacingUnit,
        letterSpacingValue: t.letterSpacingValue,
        textCase:           t.textCase,
        textDecoration:     t.textDecoration,
      }
    }
    case 'manual-values': {
      const t = target as ManualValuesTarget
      return {
        type: 'manual-values',
        displayName: 'Manual Values',
        fontFamily:         t.fontFamily,
        fontStyle:          t.fontStyle,
        fontWeight:         t.fontWeight,
        fontSize:           t.fontSize,
        lineHeightUnit:     t.lineHeightUnit,
        lineHeightValue:    t.lineHeightValue,
        letterSpacingUnit:  t.letterSpacingUnit,
        letterSpacingValue: t.letterSpacingValue,
        textCase:           t.textCase,
        textDecoration:     t.textDecoration,
      }
    }
    case 'existing-variable': {
      const t = target as ExistingVariableTarget
      return {
        type: 'existing-variable',
        displayName: t.variableName,
        collectionName: t.collectionName,
        // Actual typography values unknown without resolving the variable at runtime
      }
    }
    case 'skip':
      return { type: 'skip', displayName: 'Skipped' }
  }
}

// ---------------------------------------------------------------------------
// Property-level diff
// ---------------------------------------------------------------------------

function fmtLH(unit: string, value: number): string {
  return unit === 'AUTO' ? 'Auto' : `${value}${unit === 'PERCENT' ? '%' : 'px'}`
}
function fmtLS(unit: string, value: number): string {
  return `${value}${unit === 'PERCENT' ? '%' : 'px'}`
}

export function detectChanges(
  before: TypographyProperties,
  after: ResolvedTarget
): PropertyChange[] {
  const changes: PropertyChange[] = []

  // Font Family
  if (after.fontFamily !== undefined) {
    changes.push({ property: 'Font Family', before: before.fontFamily, after: after.fontFamily, changed: before.fontFamily !== after.fontFamily })
  } else {
    changes.push({ property: 'Font Family', before: before.fontFamily, after: '—', changed: false, inherited: true })
  }

  // Font Style
  if (after.fontStyle !== undefined) {
    changes.push({ property: 'Font Style', before: before.fontStyle, after: after.fontStyle, changed: before.fontStyle !== after.fontStyle })
  } else {
    changes.push({ property: 'Font Style', before: before.fontStyle, after: '—', changed: false, inherited: true })
  }

  // Font Weight
  if (after.fontWeight !== undefined) {
    changes.push({ property: 'Font Weight', before: String(before.fontWeight), after: String(after.fontWeight), changed: before.fontWeight !== after.fontWeight })
  } else {
    changes.push({ property: 'Font Weight', before: String(before.fontWeight), after: '—', changed: false, inherited: true })
  }

  // Font Size
  if (after.fontSize !== undefined) {
    changes.push({ property: 'Font Size', before: `${before.fontSize}px`, after: `${after.fontSize}px`, changed: before.fontSize !== after.fontSize })
  } else {
    changes.push({ property: 'Font Size', before: `${before.fontSize}px`, after: '—', changed: false, inherited: true })
  }

  // Line Height
  const beforeLH = fmtLH(before.lineHeight.unit, before.lineHeight.value)
  if (after.lineHeightUnit !== undefined) {
    const afterLH = fmtLH(after.lineHeightUnit, after.lineHeightValue ?? 0)
    changes.push({ property: 'Line Height', before: beforeLH, after: afterLH,
      changed: before.lineHeight.unit !== after.lineHeightUnit || before.lineHeight.value !== (after.lineHeightValue ?? 0) })
  } else {
    changes.push({ property: 'Line Height', before: beforeLH, after: '—', changed: false, inherited: true })
  }

  // Letter Spacing
  const beforeLS = fmtLS(before.letterSpacing.unit, before.letterSpacing.value)
  if (after.letterSpacingUnit !== undefined) {
    const afterLS = fmtLS(after.letterSpacingUnit, after.letterSpacingValue ?? 0)
    changes.push({ property: 'Letter Spacing', before: beforeLS, after: afterLS,
      changed: before.letterSpacing.unit !== after.letterSpacingUnit || before.letterSpacing.value !== (after.letterSpacingValue ?? 0) })
  } else {
    changes.push({ property: 'Letter Spacing', before: beforeLS, after: '—', changed: false, inherited: true })
  }

  // Text Case
  const CASE: Record<string, string> = { ORIGINAL: 'None', UPPER: 'Uppercase', LOWER: 'Lowercase', TITLE: 'Title Case', SMALL_CAPS: 'Small Caps', SMALL_CAPS_FORCED: 'All Small Caps' }
  const DECO: Record<string, string> = { NONE: 'None', UNDERLINE: 'Underline', STRIKETHROUGH: 'Strikethrough' }
  if (after.textCase !== undefined) {
    changes.push({ property: 'Text Case', before: CASE[before.textCase] ?? before.textCase, after: CASE[after.textCase] ?? after.textCase, changed: before.textCase !== after.textCase })
  } else {
    changes.push({ property: 'Text Case', before: CASE[before.textCase] ?? before.textCase, after: '—', changed: false, inherited: true })
  }
  if (after.textDecoration !== undefined) {
    changes.push({ property: 'Text Decoration', before: DECO[before.textDecoration] ?? before.textDecoration, after: DECO[after.textDecoration] ?? after.textDecoration, changed: before.textDecoration !== after.textDecoration })
  } else {
    changes.push({ property: 'Text Decoration', before: DECO[before.textDecoration] ?? before.textDecoration, after: '—', changed: false, inherited: true })
  }

  return changes
}

// ---------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------

export function calculateRisk(
  family: CandidateFamily,
  entry: MigrationEntry,
  conflicts: Conflict[]
): { risk: RiskLevel; riskFactors: string[] } {
  let score = 0
  const riskFactors: string[] = []

  // Layer count
  if (family.totalLayers >= RISK.LAYERS_VERY_HIGH) {
    score += 30
    riskFactors.push(`${family.totalLayers.toLocaleString()} layers will be affected`)
  } else if (family.totalLayers >= RISK.LAYERS_HIGH) {
    score += 15
  } else if (family.totalLayers >= RISK.LAYERS_MEDIUM) {
    score += 5
  }

  // Component/instance involvement
  const compCount = (family.usageBreakdown['COMPONENT'] ?? 0) + (family.usageBreakdown['INSTANCE'] ?? 0)
  if (compCount >= RISK.COMPS_HIGH) {
    score += 20
    riskFactors.push(`${compCount.toLocaleString()} component and instance layers affected`)
  } else if (compCount >= RISK.COMPS_MEDIUM) {
    score += 10
  }

  // Outliers (heterogeneous family = higher risk)
  if (family.outlierCount > 0) {
    const outlierScore = Math.min(family.outlierCount * 10, 30)
    score += outlierScore
    riskFactors.push(`${family.outlierCount} outlier${family.outlierCount !== 1 ? 's' : ''} in this family may not benefit from this change`)
  }

  // Library style target (multi-file impact)
  if (entry.target?.type === 'existing-style') {
    const t = entry.target as ExistingStyleTarget
    if (t.libraryName) {
      score += 15
      riskFactors.push('Target is a library style — changes may affect multiple files')
    }
  }

  // Conflicts
  if (conflicts.some(c => c.familyId === family.id)) {
    score += 25
    riskFactors.push('Conflict detected — review before execution')
  }

  // Low family confidence
  if (family.confidence < 70) {
    score += 10
    riskFactors.push(`Low similarity confidence (${family.confidence}%) — this family may be heterogeneous`)
  }

  // Multi-page scope
  if (family.pageIds.size > 3) {
    score += 5
    riskFactors.push(`Spans ${family.pageIds.size} pages`)
  }

  if (riskFactors.length === 0) riskFactors.push('No significant risk factors detected')

  const risk: RiskLevel =
    score >= RISK.SCORE_VERY_HIGH ? 'Very High'
    : score >= RISK.SCORE_HIGH    ? 'High'
    : score >= RISK.SCORE_MEDIUM  ? 'Medium'
    : 'Low'

  return { risk, riskFactors }
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildPreviewItems(
  families: CandidateFamily[],
  entries: Record<string, MigrationEntry>,
  textStyles: AvailableTextStyle[],
  variables: AvailableTypographyVariable[],
  conflicts: Conflict[]
): PreviewItem[] {
  const styleMap = new Map(textStyles.map(s => [s.id, s]))
  const varMap   = new Map(variables.map(v => [v.id, v]))

  return families
    .filter(f => {
      const e = entries[f.id]
      return e && (e.status === 'planned' || e.status === 'modified') && e.target
    })
    .map(family => {
      const entry  = entries[family.id]
      const after  = resolveTarget(entry.target!, styleMap, varMap)
      const changes = detectChanges(family.dominant, after)
      const { risk, riskFactors } = calculateRisk(family, entry, conflicts)

      return {
        familyId: family.id,
        family,
        entry,
        before: family.dominant,
        after,
        changes,
        changedCount: changes.filter(c => c.changed).length,
        affectedLayers:     family.totalLayers,
        affectedPages:      family.pageIds.size,
        affectedComponents: family.usageBreakdown['COMPONENT']    ?? 0,
        affectedInstances:  family.usageBreakdown['INSTANCE']     ?? 0,
        affectedVariants:   family.usageBreakdown['COMPONENT_SET'] ?? 0,
        risk,
        riskFactors,
        validationIssues: [],  // filled by runValidation
      }
    })
    .sort((a, b) => {
      // Sort Very High risk first, then by layer count
      const ORDER: Record<RiskLevel, number> = { 'Very High': 0, 'High': 1, 'Medium': 2, 'Low': 3 }
      const riskDiff = ORDER[a.risk] - ORDER[b.risk]
      return riskDiff !== 0 ? riskDiff : b.affectedLayers - a.affectedLayers
    })
}
