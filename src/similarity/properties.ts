/**
 * Per-property similarity functions.
 *
 * Exported separately so both the main scorer (fixed weights) and the
 * clustering engine (configurable weights) can import them without
 * code duplication.
 *
 * Each function returns a value in [0, 1].
 * 1.0 = identical or within negligible tolerance.
 * 0.0 = maximally different or categorically incompatible.
 */

import type { NormalizedLineHeight, NormalizedLetterSpacing } from '../modules/typography/types'

/** Categorical: same family = 1.0, any other = 0.0. */
export function fontFamilySim(a: string, b: string): number {
  return a === b ? 1.0 : 0.0
}

/**
 * Ratio-based size comparison.
 * Scores drop linearly to 0 as the ratio approaches 0.5 (one size doubles).
 */
export function fontSizeSim(a: number, b: number): number {
  if (a === b) return 1.0
  if (a <= 0 || b <= 0) return 0.0
  const ratio = Math.min(a, b) / Math.max(a, b)
  return Math.max(0, (ratio - 0.5) * 2)
}

/** Linear over a 300-unit weight span. */
export function fontWeightSim(a: number, b: number): number {
  return Math.max(0, 1 - Math.abs(a - b) / 300)
}

/** Unit-aware line height comparison. */
export function lineHeightSim(a: NormalizedLineHeight, b: NormalizedLineHeight): number {
  if (a.unit === 'AUTO' && b.unit === 'AUTO') return 1.0
  if (a.unit !== b.unit) return 0.4
  if (a.unit === 'AUTO' || b.unit === 'AUTO') return 0.7
  if (a.value === 0 && b.value === 0) return 1.0
  const max = Math.max(a.value, b.value)
  if (max === 0) return 1.0
  return Math.max(0, (Math.min(a.value, b.value) / max - 0.5) * 2)
}

/** Absolute difference with per-unit scale. */
export function letterSpacingSim(a: NormalizedLetterSpacing, b: NormalizedLetterSpacing): number {
  if (a.unit !== b.unit) return 0.3
  return Math.max(0, 1 - Math.abs(a.value - b.value) / (a.unit === 'PIXELS' ? 5.0 : 10.0))
}

/** Categorical. */
export function textCaseSim(a: string, b: string): number { return a === b ? 1.0 : 0.0 }

/** Categorical. */
export function textDecorationSim(a: string, b: string): number { return a === b ? 1.0 : 0.0 }
