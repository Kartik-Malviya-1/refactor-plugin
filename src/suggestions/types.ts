import type { ConsolidationTarget, ConsolidationTargetType } from '../shared/migration'

export type SuggestionConfidenceLabel = 'Very High' | 'High' | 'Medium' | 'Low'

/**
 * A single piece of evidence supporting a Smart Suggestion.
 * Every suggestion must have at least one reason with a non-empty text.
 */
export interface SuggestionReason {
  /** Human-readable explanation of why this suggestion is being made. */
  text: string
  /** Supporting data (e.g. "94% typography similarity", "16px exact match"). */
  evidence?: string
}

/**
 * A single ranked Smart Suggestion for a Typography Family.
 *
 * Fully deterministic and explainable — no LLM, no AI naming.
 * Every field is derived from observable data only.
 */
export interface SmartSuggestion {
  /** Stable ID within the family’s suggestion set. */
  id: string

  targetType: ConsolidationTargetType
  target: ConsolidationTarget

  /** 0–100. Calculated from weighted evidence, never invented. */
  confidence: number
  confidenceLabel: SuggestionConfidenceLabel

  /** Ordered list of reasons. Must be non-empty. */
  reasons: SuggestionReason[]

  /** Estimated layers, components, pages affected if this target is accepted. */
  estimatedImpact: {
    layers: number
    components: number
    pages: number
  }

  /** 1 = top suggestion, 2 = second, etc. */
  rank: number

  /** Which evidence source produced this suggestion. */
  source:
    | 'existing-style'
    | 'existing-variable'
    | 'previously-planned'
    | 'session-learning'
    | 'fallback'
}
