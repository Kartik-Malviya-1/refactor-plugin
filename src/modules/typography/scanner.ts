import type { TypographyProperties, NormalizedLineHeight, NormalizedLetterSpacing } from './types'
import { styleToWeight } from './normalizer'
import { intern } from '../../engine/traversal'

// ---------------------------------------------------------------------------
// Typography-specific extraction
//
// extractProperties() is called by TypographyScannerAdapter.extract().
// Every Figma property access (node.fontName, node.fontSize, etc.) is an
// IPC call from the plugin sandbox to the Figma main thread. Each call is
// individually timed by _extractionInstrument below.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Instrumentation
//
// Tracks per-property IPC timing and access counts across all nodes in a scan.
// Reset by calling resetExtractionInstrument() before scanEngine.run().
// Read by main.ts to print the detailed Stage 4 breakdown.
// ---------------------------------------------------------------------------

export interface ExtractionInstrument {
  // Per-property IPC timing (accumulated across all nodes)
  fontNameMs: number
  fontSizeMs: number
  lineHeightMs: number
  letterSpacingMs: number
  textCaseMs: number
  textDecorationMs: number

  // Per-property access counts
  fontNameAccesses: number
  fontSizeAccesses: number
  lineHeightAccesses: number
  letterSpacingAccesses: number
  textCaseAccesses: number
  textDecorationAccesses: number

  // getRangeXxx calls — only triggered when node has mixed typography
  getRangeFontNameCalls: number
  getRangeFontSizeCalls: number
  getRangeLineHeightCalls: number
  getRangeLetterSpacingCalls: number
  getRangeTextCaseCalls: number
  getRangeTextDecorationCalls: number

  // These are zero — not implemented in current scanner.
  // Reported explicitly to confirm the scanner is not accessing these.
  sharedPluginDataAccesses: number
  variableLookups: number
}

export const _extractionInstrument: ExtractionInstrument = {
  fontNameMs: 0,
  fontSizeMs: 0,
  lineHeightMs: 0,
  letterSpacingMs: 0,
  textCaseMs: 0,
  textDecorationMs: 0,
  fontNameAccesses: 0,
  fontSizeAccesses: 0,
  lineHeightAccesses: 0,
  letterSpacingAccesses: 0,
  textCaseAccesses: 0,
  textDecorationAccesses: 0,
  getRangeFontNameCalls: 0,
  getRangeFontSizeCalls: 0,
  getRangeLineHeightCalls: 0,
  getRangeLetterSpacingCalls: 0,
  getRangeTextCaseCalls: 0,
  getRangeTextDecorationCalls: 0,
  sharedPluginDataAccesses: 0,
  variableLookups: 0,
}

export function resetExtractionInstrument(): void {
  _extractionInstrument.fontNameMs = 0
  _extractionInstrument.fontSizeMs = 0
  _extractionInstrument.lineHeightMs = 0
  _extractionInstrument.letterSpacingMs = 0
  _extractionInstrument.textCaseMs = 0
  _extractionInstrument.textDecorationMs = 0
  _extractionInstrument.fontNameAccesses = 0
  _extractionInstrument.fontSizeAccesses = 0
  _extractionInstrument.lineHeightAccesses = 0
  _extractionInstrument.letterSpacingAccesses = 0
  _extractionInstrument.textCaseAccesses = 0
  _extractionInstrument.textDecorationAccesses = 0
  _extractionInstrument.getRangeFontNameCalls = 0
  _extractionInstrument.getRangeFontSizeCalls = 0
  _extractionInstrument.getRangeLineHeightCalls = 0
  _extractionInstrument.getRangeLetterSpacingCalls = 0
  _extractionInstrument.getRangeTextCaseCalls = 0
  _extractionInstrument.getRangeTextDecorationCalls = 0
  _extractionInstrument.sharedPluginDataAccesses = 0
  _extractionInstrument.variableLookups = 0
}

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
// OPTIMISED extractor — single property access per field.
//
// Each `node.*` assignment below is one IPC call from the plugin sandbox
// to the Figma main thread. The timing wrappers measure the wall-clock
// cost of each call individually so the report can show which property
// is the most expensive IPC endpoint.
// ---------------------------------------------------------------------------

export function extractProperties(node: TextNode): TypographyProperties | null {
  try {
    // ── IPC call 1: fontName ───────────────────────────────────────
    let _t = Date.now()
    const rawFontName = node.fontName
    _extractionInstrument.fontNameMs += Date.now() - _t
    _extractionInstrument.fontNameAccesses++

    // ── IPC call 2: fontSize ───────────────────────────────────────
    _t = Date.now()
    const rawFontSize = node.fontSize
    _extractionInstrument.fontSizeMs += Date.now() - _t
    _extractionInstrument.fontSizeAccesses++

    // ── IPC call 3: lineHeight ─────────────────────────────────────
    _t = Date.now()
    const rawLH = node.lineHeight
    _extractionInstrument.lineHeightMs += Date.now() - _t
    _extractionInstrument.lineHeightAccesses++

    // ── IPC call 4: letterSpacing ─────────────────────────────────
    _t = Date.now()
    const rawLS = node.letterSpacing
    _extractionInstrument.letterSpacingMs += Date.now() - _t
    _extractionInstrument.letterSpacingAccesses++

    // ── IPC call 5: textCase ──────────────────────────────────────
    _t = Date.now()
    const rawTC = node.textCase
    _extractionInstrument.textCaseMs += Date.now() - _t
    _extractionInstrument.textCaseAccesses++

    // ── IPC call 6: textDecoration ─────────────────────────────────
    _t = Date.now()
    const rawTD = node.textDecoration
    _extractionInstrument.textDecorationMs += Date.now() - _t
    _extractionInstrument.textDecorationAccesses++

    // ── Resolve mixed values (getRangeXxx calls) ────────────────────
    // These are additional IPC calls, only triggered for mixed-font nodes.

    let fontName: FontName
    if (rawFontName === figma.mixed) {
      _extractionInstrument.getRangeFontNameCalls++
      fontName = node.getRangeFontName(0, 1) as FontName
    } else {
      fontName = rawFontName as FontName
    }

    let fontSize: number
    if (rawFontSize === figma.mixed) {
      _extractionInstrument.getRangeFontSizeCalls++
      fontSize = node.getRangeFontSize(0, 1) as number
    } else {
      fontSize = rawFontSize as number
    }

    let lhResolved: LineHeight
    if (rawLH === figma.mixed) {
      _extractionInstrument.getRangeLineHeightCalls++
      lhResolved = node.getRangeLineHeight(0, 1) as LineHeight
    } else {
      lhResolved = rawLH as LineHeight
    }

    const lineHeight: NormalizedLineHeight =
      lhResolved.unit === 'AUTO'
        ? { unit: 'AUTO', value: 0 }
        : { unit: lhResolved.unit, value: Math.round(lhResolved.value * 100) / 100 }

    let lsResolved: LetterSpacing
    if (rawLS === figma.mixed) {
      _extractionInstrument.getRangeLetterSpacingCalls++
      lsResolved = node.getRangeLetterSpacing(0, 1) as LetterSpacing
    } else {
      lsResolved = rawLS as LetterSpacing
    }

    const letterSpacing: NormalizedLetterSpacing = {
      unit: lsResolved.unit,
      value: Math.round(lsResolved.value * 100) / 100,
    }

    let tc: TextCase
    if (rawTC === figma.mixed) {
      _extractionInstrument.getRangeTextCaseCalls++
      tc = node.getRangeTextCase(0, 1) as TextCase
    } else {
      tc = rawTC as TextCase
    }

    let td: TextDecoration
    if (rawTD === figma.mixed) {
      _extractionInstrument.getRangeTextDecorationCalls++
      td = node.getRangeTextDecoration(0, 1) as TextDecoration
    } else {
      td = rawTD as TextDecoration
    }

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
