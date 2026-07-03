import type { AuditGroup, SourceType } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'
import type { ConsolidationTarget } from '../shared/migration'
import type { PropertyWeights } from '../similarity/scorer'

export type { PropertyWeights }

// ---------------------------------------------------------------------------
// Typography Signature Identity Model
//
// Each AuditGroup carries two string identifiers. Only one is canonical.
//
//   AuditGroup.key  — CANONICAL identifier.
//     Derived deterministically by normalizeTypographyProps() in normalizer.ts.
//     Encodes all discriminating properties as a pipe-separated string:
//       fontFamily|fontStyle|fontSize|lineHeight|letterSpacing|
//       textCase|textDecoration|sourceType:styleId
//     Example:
//       "Inter|Regular|16|auto|PIXELS:0|ORIGINAL|NONE|LibraryStyle:S:abc"
//     Properties:
//       ✓ Stable across repeated scans of the same document
//       ✓ Stable across application restarts
//       ✓ Independent of sort order, search, filter, and pagination
//       ✓ Collision-free (it IS the full canonical string)
//       ✓ Module-independent (no moduleId embedded)
//     Use for: assignments, mappings, migration plan, preview, apply,
//              reports, navigation, orphan pruning, persistent storage.
//
//   AuditGroup.id  — DERIVED convenience handle.
//     Format: "${moduleId}_${hash32(key)}" (e.g. "typography_2a3f4b").
//     Also deterministic within a session, but:
//       ✗ Hash collisions possible (~1-in-4B per pair with 32-bit djb2)
//       ✗ Module-coupled: changes if moduleId is ever renamed
//     Use for: React rendering keys (.map(g => <Row key={g.id} />)) only.
//
//   NodeLocation.id  — specific Figma node. Never reused. Not a signature ID.
//
// Rule: use AuditGroup.key everywhere identity is required.
//       Never mix id and key for the same concern.
// ---------------------------------------------------------------------------

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
// Cluster reason
// ---------------------------------------------------------------------------

export type ClusterReasonType = 'match' | 'similar' | 'different'

export interface ClusterReason {
  property: string
  description: string
  type: ClusterReasonType
}

// ---------------------------------------------------------------------------
// Typography Cluster
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
  clusterReasons: ClusterReason[]
  sourceBreakdown: Partial<Record<SourceType, number>>
  usageBreakdown: Record<string, number>
  outlierIds: Set<string>
  outlierCount: number
  pageIds: Set<string>
  memberSimilarities: Map<string, number>
}

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------

/**
 * An assignment target for one or more Typography Signatures.
 * Stored per signature in useAssignmentStore, keyed by AuditGroup.key.
 * One signature → one AssignedTarget at most.
 */
export interface AssignedTarget {
  /** Human-readable label for display. */
  label: string
  target: ConsolidationTarget
}

/**
 * Internal mapping generated from user assignments.
 * References AuditGroup.key (canonical), never AuditGroup.id.
 */
export interface InternalMapping {
  signatureKey: string      // AuditGroup.key — canonical signature identity
  clusterId: string
  targetType: ConsolidationTarget['type']
  target: ConsolidationTarget
}
