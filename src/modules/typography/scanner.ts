import type { TypographyProperties, NormalizedLineHeight, NormalizedLetterSpacing } from './types'
import { styleToWeight } from './normalizer'
import { intern } from '../../engine/traversal'

// ---------------------------------------------------------------------------
// Typography-specific extraction
//
// This file owns the Figma Plugin API calls that read text node properties.
// Traversal, scope handling, progress, and cancellation have moved to the
// Core Scan Engine (engine/traversal.ts).
//
// extractProperties() is called by TypographyScannerAdapter.extract().
// extractPropertiesBaseline() is retained for future benchmark comparisons.
// ---------------------------------------------------------------------------

// Module-level intern pool for font strings.
// Shares the engine's pool via the imported intern() function so all
// string values across traversal and extraction are deduplicated.

// ---------------------------------------------------------------------------
// BASELINE extractor — original double-access pattern.
// Not used for scanning; retained for benchmark comparison tooling.
// ---------------------------------------------------------------------------

export function extractPropertiesBaseline(node: TextNode): TypographyProperties | null {
  try {
    const fontName: FontName =
      node.fontName === figma.mixed
        ? (node.getRangeFontName(0, 1) as FontName)
        : (node.fontName as FontName)

    const fontSize: number =
      node.fontSize === figma.mixed
        ? (node.getRangeFontSize(0, 1) as number)
        : (node.fontSize as number)

    const rawLH: LineHeight =
      node.lineHeight === figma.mixed
        ? (node.getRangeLineHeight(0, 1) as LineHeight)
        : (node.lineHeight as LineHeight)

    const rawLS: LetterSpacing =
      node.letterSpacing === figma.mixed
        ? (node.getRangeLetterSpacing(0, 1) as LetterSpacing)
        : (node.letterSpacing as LetterSpacing)

    const rawTC: TextCase =
      node.textCase === figma.mixed
        ? (node.getRangeTextCase(0, 1) as TextCase)
        : (node.textCase as TextCase)

    const rawTD: TextDecoration =
      node.textDecoration === figma.mixed
        ? (node.getRangeTextDecoration(0, 1) as TextDecoration)
        : (node.textDecoration as TextDecoration)

    const lineHeight: NormalizedLineHeight =
      rawLH.unit === 'AUTO'
        ? { unit: 'AUTO', value: 0 }
        : { unit: rawLH.unit, value: Math.round(rawLH.value * 100) / 100 }

    const letterSpacing: NormalizedLetterSpacing = {
      unit: rawLS.unit,
      value: Math.round(rawLS.value * 100) / 100,
    }

    return {
      fontFamily: fontName.family,
      fontStyle: fontName.style,
      fontWeight: styleToWeight(fontName.style),
      fontSize: Math.round(fontSize * 100) / 100,
      lineHeight,
      letterSpacing,
      textCase: rawTC as TypographyProperties['textCase'],
      textDecoration: rawTD as TypographyProperties['textDecoration'],
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// OPTIMISED extractor — single property access per field + string interning.
// Called by TypographyScannerAdapter.extract().
// ---------------------------------------------------------------------------

export function extractProperties(node: TextNode): TypographyProperties | null {
  try {
    const rawFontName = node.fontName
    const rawFontSize = node.fontSize
    const rawLH       = node.lineHeight
    const rawLS       = node.letterSpacing
    const rawTC       = node.textCase
    const rawTD       = node.textDecoration

    const fontName: FontName = rawFontName === figma.mixed
      ? (node.getRangeFontName(0, 1) as FontName)
      : (rawFontName as FontName)

    const fontSize: number = rawFontSize === figma.mixed
      ? (node.getRangeFontSize(0, 1) as number)
      : (rawFontSize as number)

    const lhResolved: LineHeight = rawLH === figma.mixed
      ? (node.getRangeLineHeight(0, 1) as LineHeight)
      : (rawLH as LineHeight)

    const lineHeight: NormalizedLineHeight =
      lhResolved.unit === 'AUTO'
        ? { unit: 'AUTO', value: 0 }
        : { unit: lhResolved.unit, value: Math.round(lhResolved.value * 100) / 100 }

    const lsResolved: LetterSpacing = rawLS === figma.mixed
      ? (node.getRangeLetterSpacing(0, 1) as LetterSpacing)
      : (rawLS as LetterSpacing)

    const letterSpacing: NormalizedLetterSpacing = {
      unit: lsResolved.unit,
      value: Math.round(lsResolved.value * 100) / 100,
    }

    const tc: TextCase = rawTC === figma.mixed
      ? (node.getRangeTextCase(0, 1) as TextCase)
      : (rawTC as TextCase)

    const td: TextDecoration = rawTD === figma.mixed
      ? (node.getRangeTextDecoration(0, 1) as TextDecoration)
      : (rawTD as TextDecoration)

    return {
      fontFamily: intern(fontName.family),
      fontStyle:  intern(fontName.style),
      fontWeight: styleToWeight(fontName.style),
      fontSize: Math.round(fontSize * 100) / 100,
      lineHeight,
      letterSpacing,
      textCase: tc as TypographyProperties['textCase'],
      textDecoration: td as TypographyProperties['textDecoration'],
    }
  } catch {
    return null
  }
}
