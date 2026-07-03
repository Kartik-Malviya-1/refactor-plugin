import type { ClusteringConfig, ClusteringStrategy, PropertyWeights } from './types'

// ---------------------------------------------------------------------------
// Per-strategy property weights
//
// Conservative: all properties matter more — tighter clusters.
// Balanced:     default weights matching the spec (same as Sprint 3).
// Aggressive:   down-weights minor properties to force bigger clusters.
// ---------------------------------------------------------------------------

export const STRATEGY_WEIGHTS: Record<ClusteringStrategy, PropertyWeights> = {
  conservative: {
    fontFamily:    12,  // Very High
    fontSize:      11,  // Very High
    fontWeight:     9,  // High
    lineHeight:     7,  // Medium
    letterSpacing:  4,  // Low
    textCase:       2,  // Very Low
    textDecoration: 2,  // Very Low
  },
  balanced: {
    fontFamily:    10,  // Very High
    fontSize:       9,  // Very High
    fontWeight:     7,  // High
    lineHeight:     5,  // Medium
    letterSpacing:  2,  // Low
    textCase:       1,  // Very Low
    textDecoration: 1,  // Very Low
  },
  aggressive: {
    fontFamily:     8,  // Still important but more tolerant
    fontSize:       6,
    fontWeight:     4,
    lineHeight:     2,
    letterSpacing:  1,
    textCase:       1,
    textDecoration: 1,
  },
  custom: {
    // Same as balanced by default; user can override via setCustomConfig()
    fontFamily:    10,
    fontSize:       9,
    fontWeight:     7,
    lineHeight:     5,
    letterSpacing:  2,
    textCase:       1,
    textDecoration: 1,
  },
}

/** Merge threshold: minimum similarity to join an existing cluster. */
export const STRATEGY_MERGE_THRESHOLD: Record<ClusteringStrategy, number> = {
  conservative: 90,
  balanced:     75,
  aggressive:   55,
  custom:       75,  // user-configurable default
}

/** Outlier threshold: below this similarity to dominant = outlier flag. */
export const STRATEGY_OUTLIER_THRESHOLD: Record<ClusteringStrategy, number> = {
  conservative: 80,
  balanced:     55,
  aggressive:   35,
  custom:       55,
}

export const STRATEGY_LABELS: Record<ClusteringStrategy, string> = {
  conservative: 'Conservative',
  balanced:     'Balanced',
  aggressive:   'Aggressive',
  custom:       'Custom',
}

export const STRATEGY_DESCRIPTIONS: Record<ClusteringStrategy, string> = {
  conservative: 'Only group nearly identical signatures. Best for mature design systems.',
  balanced:     'A practical balance between consolidation and accuracy. Suitable for most organizations.',
  aggressive:   'Merge more signatures to maximise consolidation. Suitable for startups and messy files.',
  custom:       'Configure property weights, thresholds and outlier sensitivity manually.',
}

/** Build a complete ClusteringConfig for a given strategy. */
export function buildConfig(strategy: ClusteringStrategy, customOverride?: Partial<ClusteringConfig>): ClusteringConfig {
  const base: ClusteringConfig = {
    strategy,
    mergeThreshold:    STRATEGY_MERGE_THRESHOLD[strategy],
    outlierThreshold:  STRATEGY_OUTLIER_THRESHOLD[strategy],
    weights:           { ...STRATEGY_WEIGHTS[strategy] },
  }
  if (strategy === 'custom' && customOverride) {
    return { ...base, ...customOverride, strategy: 'custom' }
  }
  return base
}
