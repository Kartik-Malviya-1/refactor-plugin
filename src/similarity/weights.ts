/**
 * PROPERTY_WEIGHTS
 *
 * Configurable importance weights for typography similarity scoring.
 * Higher weight = stronger influence on the similarity score.
 *
 * Separated from the similarity algorithm so weights can be tuned
 * independently for future organisation-specific calibration.
 * Future versions may expose these in a Settings panel.
 */
export const PROPERTY_WEIGHTS = {
  fontFamily:      10,  // Very High — different families = fundamentally different
  fontSize:         9,  // Very High — size is the most visible typographic dimension
  fontWeight:       7,  // High     — weight affects hierarchy and emphasis
  lineHeight:       5,  // Medium   — affects readability and vertical rhythm
  letterSpacing:    2,  // Low      — subtle; often a fine-tuning detail
  textCase:         1,  // Very Low — presentation only
  textDecoration:   1,  // Very Low — presentation only
} as const

/** Sum of all weights. Used to normalise raw scores to 0–100. */
export const TOTAL_WEIGHT = (Object.values(PROPERTY_WEIGHTS) as number[]).reduce(
  (a, b) => a + b,
  0
) // 35

/**
 * FAMILY_CONFIG
 *
 * Configurable thresholds for the Candidate Family generation algorithm.
 * Intentionally separated from PROPERTY_WEIGHTS so that the scoring
 * algorithm and the family-building strategy can be tuned independently.
 *
 * This separation enables future experimentation with clustering strategies
 * (e.g. hierarchical clustering, k-means) without touching the underlying
 * similarity calculations, which is what Sprint 4 will rely on.
 */
export const FAMILY_CONFIG = {
  /**
   * Two signatures are merged into the same Candidate Family only if their
   * similarity score meets or exceeds this threshold (0–100).
   *
   * Lower  = more aggressive merging (fewer, larger, more diverse families).
   * Higher = more conservative merging (more families, tighter groups).
   */
  MERGE_THRESHOLD: 75,

  /**
   * A member is flagged as an Outlier within its family when its similarity
   * to the family’s dominant signature falls below this value (0–100).
   * Should be strictly less than MERGE_THRESHOLD.
   */
  OUTLIER_THRESHOLD: 55,
} as const
