import type { TypographyProperties } from '../modules/typography/types'
import type { NormalizedLineHeight, NormalizedLetterSpacing } from '../modules/typography/types'
import { PROPERTY_WEIGHTS, TOTAL_WEIGHT } from './weights'

// ---------------------------------------------------------------------------
// Per-property similarity functions
//
// Each function returns a value in [0, 1].
// 1.0 = identical or within negligible tolerance.
// 0.0 = maximally different (or categorically incompatible).
//
// These functions are pure and stateless. They have no knowledge of weights,
// thresholds, or family-building strategy.
// ---------------------------------------------------------------------------

/** Categorical: same family = 1.0, any other = 0.0. */
function fontFamilySim(a: string, b: string): number {
  return a === b ? 1.0 : 0.0
}

/**
 * Ratio-based size comparison.
 * Sizes within ~10% of each other score near 1.0.
 * Scores drop linearly to 0 as the ratio approaches 0.5 (one size doubles).
 * Sizes more than 2× apart score 0.0.
 */
function fontSizeSim(a: number, b: number): number {
  if (a === b) return 1.0
  if (a <= 0 || b <= 0) return 0.0
  const ratio = Math.min(a, b) / Math.max(a, b)  // always in (0, 1]
  // Linear: 0.5 ratio → 0.0, 1.0 ratio → 1.0
  return Math.max(0, (ratio - 0.5) * 2)
}

/**
 * Linear weight comparison over a 300-unit span.
 * Adjacent weights (e.g. 400→500) score ~0.67.
 * Weights 300 units apart score 0.0.
 */
function fontWeightSim(a: number, b: number): number {
  const diff = Math.abs(a - b)
  return Math.max(0, 1 - diff / 300)
}

/**
 * Unit-aware line height comparison.
 * AUTO vs AUTO = identical.
 * Different units = significant mismatch (0.4).
 * Same numeric unit: ratio-based with same curve as fontSize.
 */
function lineHeightSim(a: NormalizedLineHeight, b: NormalizedLineHeight): number {
  if (a.unit === 'AUTO' && b.unit === 'AUTO') return 1.0
  if (a.unit !== b.unit) return 0.4
  if (a.unit === 'AUTO' || b.unit === 'AUTO') return 0.7
  if (a.value === 0 && b.value === 0) return 1.0
  const max = Math.max(a.value, b.value)
  if (max === 0) return 1.0
  const ratio = Math.min(a.value, b.value) / max
  return Math.max(0, (ratio - 0.5) * 2)
}

/**
 * Absolute difference with per-unit scale.
 * PIXELS: 0–0.5px negligible, 5px = 0.
 * PERCENT: 0–10% range.
 */
function letterSpacingSim(a: NormalizedLetterSpacing, b: NormalizedLetterSpacing): number {
  if (a.unit !== b.unit) return 0.3
  const diff = Math.abs(a.value - b.value)
  const maxDiff = a.unit === 'PIXELS' ? 5.0 : 10.0
  return Math.max(0, 1 - diff / maxDiff)
}

/** Categorical: same = 1.0, different = 0.0. */
function textCaseSim(a: string, b: string): number {
  return a === b ? 1.0 : 0.0
}

/** Categorical: same = 1.0, different = 0.0. */
function textDecorationSim(a: string, b: string): number {
  return a === b ? 1.0 : 0.0
}

// ---------------------------------------------------------------------------
// Main similarity function
// ---------------------------------------------------------------------------

/**
 * Computes a deterministic, weighted similarity score (0–100) between
 * two Typography Signatures.
 *
 * The algorithm is independent from:
 * • FAMILY_CONFIG thresholds (not consulted here)
 * • The family-building strategy (greedy, hierarchical, etc.)
 *
 * This separation allows the family-building algorithm to be replaced
 * or tuned without changing the underlying similarity maths.
 *
 * Score reference:
 *   95–100  Nearly identical — same visual appearance
 *   85–94   Very similar — same family, minor variants
 *   70–84   Similar — worth reviewing as a consolidation candidate
 *   50–69   Somewhat similar — review individually
 *   0–49    Likely unrelated
 */
export function computeSimilarity(
  a: TypographyProperties,
  b: TypographyProperties
): number {
  const raw =
    fontFamilySim(a.fontFamily, b.fontFamily)             * PROPERTY_WEIGHTS.fontFamily +
    fontSizeSim(a.fontSize, b.fontSize)                   * PROPERTY_WEIGHTS.fontSize +
    fontWeightSim(a.fontWeight, b.fontWeight)             * PROPERTY_WEIGHTS.fontWeight +
    lineHeightSim(a.lineHeight, b.lineHeight)             * PROPERTY_WEIGHTS.lineHeight +
    letterSpacingSim(a.letterSpacing, b.letterSpacing)    * PROPERTY_WEIGHTS.letterSpacing +
    textCaseSim(a.textCase, b.textCase)                   * PROPERTY_WEIGHTS.textCase +
    textDecorationSim(a.textDecoration, b.textDecoration) * PROPERTY_WEIGHTS.textDecoration

  return Math.round((raw / TOTAL_WEIGHT) * 100)
}
