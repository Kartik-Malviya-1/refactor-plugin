import type { AuditGroup, SourceType } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'

export type ConfidenceLabel =
  | 'Very Strong'         // ≥ 95
  | 'Strong'              // ≥ 85
  | 'Review Recommended'  // ≥ 70
  | 'Weak'                // < 70

/**
 * CandidateFamily — a proposed grouping of similar Typography Signatures.
 *
 * This is NOT a final typography style. It is a candidate for consolidation
 * that a designer reviews, edits and approves in a later sprint.
 *
 * Design goals:
 * • Contains enough information for future migration planning.
 * • Module-agnostic structure (source/usage breakdowns use shared types).
 * • Reusable model for Colors, Spacing, etc. in future modules.
 */
export interface CandidateFamily {
  /** Stable ID derived from family position in the sorted result set. */
  id: string

  /** All Typography Signature groups that belong to this family. */
  members: AuditGroup<TypographyProperties>[]

  /** Number of member signatures. */
  signatureCount: number

  /** Total text layers across all member signatures. */
  totalLayers: number

  /**
   * The dominant signature: the most-used member (highest layer count).
   * Acts as the family’s canonical reference for comparison and display.
   */
  dominant: TypographyProperties

  /**
   * Family confidence score (0–100).
   * Derived from the average pairwise similarity of all members to the
   * dominant signature. A score of 100 means all members are identical.
   */
  confidence: number

  /** Human-readable confidence label derived from confidence score. */
  confidenceLabel: ConfidenceLabel

  /**
   * Per-source layer counts.
   * Shows how many text layers in this family come from each source type.
   */
  sourceBreakdown: Partial<Record<SourceType, number>>

  /**
   * Parent-type layer distribution.
   * { FRAME: 1200, COMPONENT: 800, INSTANCE: 400, ... }
   * Supports future usage analytics and migration targeting.
   */
  usageBreakdown: Record<string, number>

  /**
   * Group IDs of members whose similarity to the dominant falls below
   * OUTLIER_THRESHOLD. These are members that likely do not belong in
   * this family and may warrant individual review.
   */
  outlierIds: Set<string>

  /** Convenience: outlierIds.size. */
  outlierCount: number

  /** Unique page IDs that contain layers from this family. */
  pageIds: Set<string>

  /**
   * Per-member similarity scores relative to the dominant.
   * Indexed by group.id. Enables displaying individual member confidence.
   */
  memberSimilarities: Map<string, number>
}
