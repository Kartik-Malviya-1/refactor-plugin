import type { ConsolidationTargetType, MigrationStrategy, ConsolidationTarget } from '../shared/migration'
import type { TypographyProperties } from '../modules/typography/types'
import type { AvailableTextStyle } from '../shared/migration'
import type { SessionAccepted } from '../ui/hooks/useSessionLearning'
import { computeSimilarity } from './scorer'

// ---------------------------------------------------------------------------
// Confidence thresholds
//
// Configurable constants for assigning labels to confidence scores.
// Adjust here to tune the suggestion system without touching the algorithms.
// ---------------------------------------------------------------------------

export const CONFIDENCE_THRESHOLDS = {
  VERY_HIGH: 90,
  HIGH: 75,
  MEDIUM: 55,
  // Below MEDIUM = Low
} as const

export type SuggestionConfidenceLabel = 'Very High' | 'High' | 'Medium' | 'Low'

export function toConfidenceLabel(score: number): SuggestionConfidenceLabel {
  if (score >= CONFIDENCE_THRESHOLDS.VERY_HIGH) return 'Very High'
  if (score >= CONFIDENCE_THRESHOLDS.HIGH)      return 'High'
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM)    return 'Medium'
  return 'Low'
}

// ---------------------------------------------------------------------------
// Style match score
//
// Computes a partial similarity between a Typography Family’s dominant
// properties and an AvailableTextStyle. Only 3 properties are available
// on the style; uses the same ratio-based logic as the Sprint 3 scorer.
// ---------------------------------------------------------------------------

export const STYLE_MATCH_WEIGHTS = {
  fontFamily: 10,
  fontStyle:   7,
  fontSize:    9,
} as const

const STYLE_TOTAL_WEIGHT = 26  // 10 + 7 + 9

export function computeStyleMatchScore(
  dom: TypographyProperties,
  style: AvailableTextStyle
): number {
  // Font family: categorical (1.0 = exact match, 0.0 = different)
  const familyScore = dom.fontFamily.toLowerCase() === style.fontFamily.toLowerCase() ? 1.0 : 0.0

  // Font style: categorical with partial credit for similar styles
  // (e.g. "Regular" vs "Book" are not identical but closer than "Bold")
  const styleLower   = dom.fontStyle.toLowerCase()
  const targetLower  = style.fontStyle.toLowerCase()
  const styleScore   = styleLower === targetLower ? 1.0
    : (styleLower.includes('regular') && targetLower.includes('regular') ? 0.8 : 0.3)

  // Font size: ratio-based (same as fontSizeSim in Sprint 3)
  const a = dom.fontSize
  const b = style.fontSize
  const sizeScore = a === b ? 1.0
    : a <= 0 || b <= 0 ? 0.0
    : Math.max(0, (Math.min(a, b) / Math.max(a, b) - 0.5) * 2)

  const raw =
    familyScore * STYLE_MATCH_WEIGHTS.fontFamily +
    styleScore  * STYLE_MATCH_WEIGHTS.fontStyle +
    sizeScore   * STYLE_MATCH_WEIGHTS.fontSize

  return Math.round((raw / STYLE_TOTAL_WEIGHT) * 100)
}

// ---------------------------------------------------------------------------
// Strategy alignment boost
//
// Adds a small confidence bonus when the suggestion type aligns with
// the planning strategy selected by the designer.
// ---------------------------------------------------------------------------

export const STRATEGY_BOOST = 5  // percentage points

export function applyStrategyBoost(
  score: number,
  targetType: ConsolidationTargetType,
  strategy: MigrationStrategy | null
): number {
  if (!strategy) return score

  const aligned =
    (strategy === 'existing-design-system' && (targetType === 'existing-style' || targetType === 'existing-variable')) ||
    (strategy === 'existing-variables'     && targetType === 'existing-variable') ||
    (strategy === 'create-new'             && targetType === 'new-style') ||
    (strategy === 'manual'                 && targetType === 'manual-values')

  return aligned ? Math.min(100, score + STRATEGY_BOOST) : score
}

// ---------------------------------------------------------------------------
// Session learning boost
//
// Adds confidence when the designer has already accepted a similar target
// for other families with similar typography this session.
// Not persisted. Resets on page reload.
// ---------------------------------------------------------------------------

export const SESSION_BOOST_PER_MATCH = 10  // percentage points per matching acceptance
export const SESSION_BOOST_MAX       = 20  // maximum total boost
export const SESSION_SIMILARITY_THRESHOLD = 70  // minimum family similarity to count

function targetKey(target: ConsolidationTarget): string {
  switch (target.type) {
    case 'existing-style':    return `style:${target.styleId}`
    case 'existing-variable': return `var:${target.variableId}`
    case 'new-style':         return `new:${target.name.toLowerCase().trim()}`
    case 'manual-values':     return 'manual'
    case 'skip':              return 'skip'
  }
}

export function applySessionBoost(
  score: number,
  target: ConsolidationTarget,
  currentDom: TypographyProperties,
  sessionAccepted: SessionAccepted[]
): number {
  const key = targetKey(target)
  let totalBoost = 0

  for (const accepted of sessionAccepted) {
    if (targetKey(accepted.target) !== key) continue
    const sim = computeSimilarity(currentDom, accepted.dominantProps)
    if (sim >= SESSION_SIMILARITY_THRESHOLD) {
      totalBoost += SESSION_BOOST_PER_MATCH
      if (totalBoost >= SESSION_BOOST_MAX) break
    }
  }

  return totalBoost > 0 ? Math.min(100, score + totalBoost) : score
}
