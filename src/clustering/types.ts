import type { AuditGroup, SourceType } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'
import type { ConsolidationTarget } from '../shared/migration'
import type { PropertyWeights } from '../similarity/scorer'

export type { PropertyWeights }

// ---------------------------------------------------------------------------
// Clustering strategy
// ---------------------------------------------------------------------------

export type ClusteringStrategy = 'conservative' | 'balanced' | 'aggressive' | 'custom'

export interface ClusteringConfig {
  strategy: ClusteringStrategy
  /** Minimum similarity (0–100) to merge a signature into an existing cluster. */
  mergeThreshold: number
  /** Below this similarity to the dominant, a member is flagged as an outlier. */
  outlierThreshold: number
  /** Property weights used for similarity scoring. */
  weights: PropertyWeights
}

// ---------------------------------------------------------------------------
// Cluster reason (why this cluster exists)
// ---------------------------------------------------------------------------

export type ClusterReasonType = 'match' | 'similar' | 'different'

export interface ClusterReason {
  property: string
  description: string
  type: ClusterReasonType
}

// ---------------------------------------------------------------------------
// Typography Cluster (replaces CandidateFamily in the UI)
// ---------------------------------------------------------------------------

export type ConfidenceLabel = 'Very Strong' | 'Strong' | 'Review Recommended' | 'Weak'

export interface TypographyCluster {
  id: string
  members: AuditGroup<TypographyProperties>[]
  signatureCount: number
  totalLayers: number
  dominant: TypographyProperties
  confidence: number
  confidenceLabel: ConfidenceLabel
  /** Deterministic explanation of why this cluster exists. */
  clusterReasons: ClusterReason[]
  sourceBreakdown: Partial<Record<SourceType, number>>
  usageBreakdown: Record<string, number>
  outlierIds: Set<string>
  outlierCount: number
  pageIds: Set<string>
  /** memberSimilarities[groupId] = similarity to dominant (0-100). */
  memberSimilarities: Map<string, number>
}

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------

/**
 * An assignment target for one or more Typography Signatures.
 * Stored per-signature in the assignment store.
 * Never exposed to the user as a "mapping" object.
 */
export interface AssignedTarget {
  /** Human-readable label for display. */
  label: string
  target: ConsolidationTarget
}

/**
 * Internal mapping generated from user assignments.
 * Implementation detail — never shown to users.
 */
export interface InternalMapping {
  signatureId: string       // AuditGroup.id
  clusterId: string
  targetType: ConsolidationTarget['type']
  target: ConsolidationTarget
}
