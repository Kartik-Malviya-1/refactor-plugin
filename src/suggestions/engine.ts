import type { CandidateFamily } from '../similarity/types'
import type {
  AvailableTextStyle,
  AvailableTypographyVariable,
  ConsolidationTarget,
  ExistingStyleTarget,
  ExistingVariableTarget,
  NewStyleTarget,
  MigrationEntry,
  MigrationStrategy,
} from '../shared/migration'
import type { SmartSuggestion, SuggestionReason } from './types'
import type { SessionAccepted } from '../ui/hooks/useSessionLearning'
import {
  computeStyleMatchScore,
  applyStrategyBoost,
  applySessionBoost,
  toConfidenceLabel,
} from './confidence'
import { computeSimilarity } from './scorer'
import { FAMILY_CONFIG } from '../similarity/weights'

// ---------------------------------------------------------------------------
// Constants (configurable)
// ---------------------------------------------------------------------------

/** Minimum style match score to surface a style suggestion. */
const MIN_STYLE_SCORE = 50

/** Minimum family similarity to surface a cross-family planned suggestion. */
const MIN_CROSS_FAMILY_SIM = FAMILY_CONFIG.MERGE_THRESHOLD  // 75

/** Maximum suggestions surfaced per family. */
const MAX_SUGGESTIONS = 5

/** Confidence for the Create New Style fallback suggestion. */
const FALLBACK_CONFIDENCE = 60

// ---------------------------------------------------------------------------
// Reason builders
// ---------------------------------------------------------------------------

function buildStyleReasons(
  style: AvailableTextStyle,
  matchScore: number,
  sessionCount: number
): SuggestionReason[] {
  const reasons: SuggestionReason[] = []

  reasons.push({
    text: 'Matches an existing text style.',
    evidence: `${matchScore}% typography similarity`,
  })

  if (style.isLocal) {
    reasons.push({ text: 'Defined in this file.', evidence: 'Local text style' })
  } else if (style.libraryName) {
    reasons.push({ text: `From shared library.`, evidence: style.libraryName })
  }

  if (sessionCount > 0) {
    reasons.push({
      text: `Already selected for ${sessionCount} similar ${sessionCount === 1 ? 'family' : 'families'} this session.`,
      evidence: 'Session learning',
    })
  }

  return reasons
}

function buildCrossFamilyReasons(
  otherFamily: CandidateFamily,
  similarity: number
): SuggestionReason[] {
  return [
    {
      text: 'Previously accepted for a similar Typography Family.',
      evidence: `${similarity}% family similarity`,
    },
    {
      text: 'Consistent with an existing planning decision.',
      evidence: `${otherFamily.dominant.fontFamily} ${otherFamily.dominant.fontStyle} / ${otherFamily.dominant.fontSize}px`,
    },
  ]
}

function buildFallbackReasons(): SuggestionReason[] {
  return [
    {
      text: "Creates a new text style based on this family's dominant typography.",
      evidence: 'Dominant signature analysis',
    },
    {
      text: 'No closer existing style or variable was found.',
      evidence: 'Fallback suggestion',
    },
  ]
}

// ---------------------------------------------------------------------------
// Deduplication + ranking
// ---------------------------------------------------------------------------

function deduplicateAndRank(suggestions: SmartSuggestion[]): SmartSuggestion[] {
  const seen = new Set<string>()
  const unique = suggestions.filter((s) => {
    const key = `${s.targetType}:${s.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return unique
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_SUGGESTIONS)
    .map((s, i) => ({ ...s, rank: i + 1 }))
}

// ---------------------------------------------------------------------------
// Count how many accepted session entries match a target key
// ---------------------------------------------------------------------------

function countSessionMatches(
  target: ConsolidationTarget,
  currentDom: import('../modules/typography/types').TypographyProperties,
  sessionAccepted: SessionAccepted[]
): number {
  const key = target.type === 'existing-style'    ? `style:${(target as ExistingStyleTarget).styleId}`
            : target.type === 'existing-variable' ? `var:${(target as ExistingVariableTarget).variableId}`
            : ''
  if (!key) return 0

  return sessionAccepted.filter((a) => {
    const aKey = a.target.type === 'existing-style'    ? `style:${(a.target as ExistingStyleTarget).styleId}`
               : a.target.type === 'existing-variable' ? `var:${(a.target as ExistingVariableTarget).variableId}`
               : ''
    return aKey === key && computeSimilarity(currentDom, a.dominantProps) >= 70
  }).length
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export interface GenerateSuggestionsOptions {
  textStyles: AvailableTextStyle[]
  variables: AvailableTypographyVariable[]
  /** Other families that have been planned this session. */
  otherPlanned: Array<{ family: CandidateFamily; entry: MigrationEntry }>
  sessionAccepted: SessionAccepted[]
  strategy: MigrationStrategy | null
}

/**
 * Generates ranked Smart Suggestions for a Typography Family.
 *
 * Fully deterministic — same inputs always produce the same output.
 * No LLM. No AI naming. Every suggestion explains itself.
 *
 * Sources (in priority order):
 *  1. Existing text styles with sufficient typography similarity
 *  2. Targets already accepted for similar families this session
 *  3. Create New Style fallback (always generated)
 */
export function generateSuggestions(
  family: CandidateFamily,
  opts: GenerateSuggestionsOptions
): SmartSuggestion[] {
  const dom = family.dominant
  const suggestions: SmartSuggestion[] = []

  const impact = {
    layers:     family.totalLayers,
    components: Object.entries(family.usageBreakdown)
                  .filter(([k]) => k === 'COMPONENT' || k === 'INSTANCE')
                  .reduce((s, [, v]) => s + v, 0),
    pages:      family.pageIds.size,
  }

  // ── Source 1: Existing text styles ──────────────────────────────────
  for (const style of opts.textStyles) {
    const matchScore = computeStyleMatchScore(dom, style)
    if (matchScore < MIN_STYLE_SCORE) continue

    const target: ExistingStyleTarget = {
      type: 'existing-style',
      styleId: style.id,
      styleName: style.name,
      libraryName: style.libraryName,
      fontFamily: style.fontFamily,
      fontStyle: style.fontStyle,
      fontSize: style.fontSize,
    }

    const sessionCount = countSessionMatches(target, dom, opts.sessionAccepted)
    let confidence = matchScore
    confidence = applyStrategyBoost(confidence, 'existing-style', opts.strategy)
    confidence = applySessionBoost(confidence, target, dom, opts.sessionAccepted)

    suggestions.push({
      id: `style-${style.id}`,
      targetType: 'existing-style',
      target,
      confidence,
      confidenceLabel: toConfidenceLabel(confidence),
      reasons: buildStyleReasons(style, matchScore, sessionCount),
      estimatedImpact: impact,
      rank: 0,
      source: 'existing-style',
    })
  }

  // ── Source 2: Previously planned targets (cross-family) ─────────────────
  for (const { family: other, entry } of opts.otherPlanned) {
    if (!entry.target) continue
    const sim = computeSimilarity(dom, other.dominant)
    if (sim < MIN_CROSS_FAMILY_SIM) continue

    // Don’t duplicate if already suggested via source 1
    const isDupe = suggestions.some(
      (s) => s.targetType === entry.target!.type &&
        s.id.includes((entry.target as ExistingStyleTarget).styleId ?? '')
    )
    if (isDupe) continue

    let confidence = Math.round(sim * 0.9)  // slight discount for indirect evidence
    confidence = applyStrategyBoost(confidence, entry.target.type, opts.strategy)
    confidence = applySessionBoost(confidence, entry.target, dom, opts.sessionAccepted)

    suggestions.push({
      id: `planned-${other.id}`,
      targetType: entry.target.type,
      target: entry.target,
      confidence,
      confidenceLabel: toConfidenceLabel(confidence),
      reasons: buildCrossFamilyReasons(other, sim),
      estimatedImpact: impact,
      rank: 0,
      source: 'previously-planned',
    })
  }

  // ── Source 3: Create New Style fallback ───────────────────────────────
  // Always provided so users always have a path forward.
  const fallbackTarget: NewStyleTarget = {
    type: 'new-style',
    name: '',  // user must supply a name
    fontFamily:         dom.fontFamily,
    fontStyle:          dom.fontStyle,
    fontWeight:         dom.fontWeight,
    fontSize:           dom.fontSize,
    lineHeightUnit:     dom.lineHeight.unit,
    lineHeightValue:    dom.lineHeight.value,
    letterSpacingUnit:  dom.letterSpacing.unit,
    letterSpacingValue: dom.letterSpacing.value,
    textCase:           dom.textCase,
    textDecoration:     dom.textDecoration,
  }

  let fallbackConfidence = FALLBACK_CONFIDENCE
  fallbackConfidence = applyStrategyBoost(fallbackConfidence, 'new-style', opts.strategy)
  fallbackConfidence = applySessionBoost(fallbackConfidence, fallbackTarget, dom, opts.sessionAccepted)

  suggestions.push({
    id: 'fallback-new-style',
    targetType: 'new-style',
    target: fallbackTarget,
    confidence: fallbackConfidence,
    confidenceLabel: toConfidenceLabel(fallbackConfidence),
    reasons: buildFallbackReasons(),
    estimatedImpact: impact,
    rank: 0,
    source: 'fallback',
  })

  return deduplicateAndRank(suggestions)
}
