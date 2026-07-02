// ---------------------------------------------------------------------------
// Performance Baselines
//
// Conservative minimum-acceptable values for each benchmarked stage.
// If actual throughput falls below baseline × REGRESSION_THRESHOLD, the
// benchmark runner flags a regression.
//
// These are deliberately conservative — the implementation should run
// significantly faster. Update intentionally when architectural changes
// alter expected performance. Never lower a baseline to hide a regression.
//
// Traversal and Extraction baselines are not here because those stages
// require live Figma API calls. Use the in-plugin profiler for those.
// ---------------------------------------------------------------------------

export interface StageBaseline {
  /** Minimum acceptable items/second throughput. */
  minItemsPerSec: number
  /** Maximum acceptable growth ratio when input doubles (2.0 = perfect linear). */
  maxScalingFactor: number
}

export const BASELINES: Record<string, StageBaseline> = {
  normalization: { minItemsPerSec: 20_000,  maxScalingFactor: 2.3 },
  grouping:      { minItemsPerSec: 10_000,  maxScalingFactor: 2.3 },
  sorting:       { minItemsPerSec: 100_000, maxScalingFactor: 3.0 },  // O(K log K) — K << N
  serialization: { minItemsPerSec: 1_000,   maxScalingFactor: 2.5 },
}

/**
 * A stage is considered regressed when actual < baseline.minItemsPerSec
 * multiplied by this factor. 0.7 = flag if >30% below budget.
 */
export const REGRESSION_THRESHOLD = 0.7

/** Warn when a serialized AuditResult payload exceeds this size. */
export const PAYLOAD_WARNING_BYTES = 10 * 1024 * 1024  // 10 MB
