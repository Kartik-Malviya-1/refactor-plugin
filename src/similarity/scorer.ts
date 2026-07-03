import type { TypographyProperties } from '../modules/typography/types'
import {
  fontFamilySim, fontSizeSim, fontWeightSim, lineHeightSim,
  letterSpacingSim, textCaseSim, textDecorationSim,
} from './properties'
import { PROPERTY_WEIGHTS, TOTAL_WEIGHT } from './weights'

// ---------------------------------------------------------------------------
// Default scorer (fixed weights from weights.ts)
// ---------------------------------------------------------------------------

/**
 * Computes a deterministic, weighted similarity score (0–100) between
 * two Typography Signatures using the default property weights.
 *
 * Separated from the clustering algorithm so weights can be tuned
 * independently of the family/cluster building strategy.
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

// ---------------------------------------------------------------------------
// Configurable scorer (custom weights for clustering engine)
// ---------------------------------------------------------------------------

export interface PropertyWeights {
  fontFamily: number
  fontSize: number
  fontWeight: number
  lineHeight: number
  letterSpacing: number
  textCase: number
  textDecoration: number
}

/**
 * Same algorithm as computeSimilarity() but accepts custom property weights.
 * Used by the clustering engine to implement Conservative/Balanced/Aggressive
 * strategies without changing the underlying similarity maths.
 */
export function computeSimilarityWithWeights(
  a: TypographyProperties,
  b: TypographyProperties,
  weights: PropertyWeights
): number {
  const total = Object.values(weights).reduce((s, w) => s + w, 0)
  if (total === 0) return 0

  const raw =
    fontFamilySim(a.fontFamily, b.fontFamily)             * weights.fontFamily +
    fontSizeSim(a.fontSize, b.fontSize)                   * weights.fontSize +
    fontWeightSim(a.fontWeight, b.fontWeight)             * weights.fontWeight +
    lineHeightSim(a.lineHeight, b.lineHeight)             * weights.lineHeight +
    letterSpacingSim(a.letterSpacing, b.letterSpacing)    * weights.letterSpacing +
    textCaseSim(a.textCase, b.textCase)                   * weights.textCase +
    textDecorationSim(a.textDecoration, b.textDecoration) * weights.textDecoration

  return Math.round((raw / total) * 100)
}
