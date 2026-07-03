import type { TypographyProperties, NormalizedLineHeight, NormalizedLetterSpacing } from './types'
import type { TypographySource } from '../../shared/typography-source'
import { styleToWeight } from './normalizer'
import { intern } from '../../engine/traversal'

// ---------------------------------------------------------------------------
// Style cache
//
// Extended in v0.2.4 to also store font properties so that
// GET_PLANNING_DATA can include library styles without additional
// figma.getStyleById() calls per style.
// ---------------------------------------------------------------------------
interface CachedStyle {
  name:    string
  remote:  boolean
  key:     string
  // Text-style-specific (undefined for non-text styles)
  fontFamily?: string
  fontStyle?:  string
  fontSize?:   number
}

const _styleCache = new Map<string, CachedStyle | null>()

function resolveStyle(styleId: string): CachedStyle | null {
  if (_styleCache.has(styleId)) return _styleCache.get(styleId)!
  try {
    const style = figma.getStyleById(styleId)
    if (!style) { _styleCache.set(styleId, null); return null }

    let fontFamily: string | undefined
    let fontStyle:  string | undefined
    let fontSize:   number | undefined

    // Capture typography properties for text styles so planning data
    // can reconstruct AvailableTextStyle without extra API calls.
    if (style.type === 'TEXT') {
      const ts = style as TextStyle
      if (ts.fontName !== figma.mixed) {
        const fn = ts.fontName as FontName
        fontFamily = fn.family
        fontStyle  = fn.style
      }
      if (ts.fontSize !== figma.mixed) {
        fontSize = ts.fontSize as number
      }
    }

    const result: CachedStyle = { name: style.name, remote: style.remote, key: style.key, fontFamily, fontStyle, fontSize }
    _styleCache.set(styleId, result)
    return result
  } catch {
    _styleCache.set(styleId, null)
    return null
  }
}

export function clearStyleCache(): void { _styleCache.clear() }

/**
 * Returns the complete style cache populated during the last scan.
 * Used by GET_PLANNING_DATA to include library styles (remote: true)
 * that figma.getLocalTextStyles() does not return.
 */
export function getDiscoveredStyles(): ReadonlyMap<string, CachedStyle | null> {
  return _styleCache
}

// ---------------------------------------------------------------------------
// Source resolution
// ---------------------------------------------------------------------------

function resolveSource(node: TextNode, textStyleId: string): TypographySource {
  try {
    const bv = (node as TextNode & { boundVariables?: Record<string, unknown> }).boundVariables
    if (bv) {
      const fontBinding = (bv as Record<string, { id?: string; type?: string }>)
      const varBinding  = fontBinding.fontFamily ?? fontBinding.fontSize ?? fontBinding.fontWeight
      if (varBinding?.id) {
        try {
          const variable   = figma.variables.getVariableById(varBinding.id)
          if (variable) {
            const collection = figma.variables.getVariableCollectionById(variable.variableCollectionId)
            return { type: 'Variable', variableId: variable.id, variableName: variable.name, variableCollection: collection?.name }
          }
        } catch { /* variables API not available */ }
      }
    }
  } catch { /* boundVariables not accessible */ }

  if (!textStyleId) return { type: 'Raw' }

  const cached = resolveStyle(textStyleId)
  if (!cached) return { type: 'LibraryStyle', styleId: textStyleId }

  if (cached.remote) {
    const segments = cached.name.split('/')
    const libraryName = segments.length > 1 ? segments[0].trim() : undefined
    return { type: 'LibraryStyle', styleId: textStyleId, styleName: cached.name, libraryName, libraryKey: cached.key }
  }

  return { type: 'LocalStyle', styleId: textStyleId, styleName: cached.name }
}

// ---------------------------------------------------------------------------
// Instrumentation
// ---------------------------------------------------------------------------

export interface ExtractionInstrument {
  fontNameMs: number; fontSizeMs: number; lineHeightMs: number
  letterSpacingMs: number; textCaseMs: number; textDecorationMs: number; textStyleIdMs: number
  fontNameAccesses: number; fontSizeAccesses: number; lineHeightAccesses: number
  letterSpacingAccesses: number; textCaseAccesses: number; textDecorationAccesses: number; textStyleIdAccesses: number
  getRangeFontNameCalls: number; getRangeFontSizeCalls: number; getRangeLineHeightCalls: number
  getRangeLetterSpacingCalls: number; getRangeTextCaseCalls: number; getRangeTextDecorationCalls: number
  sharedPluginDataAccesses: number; variableLookups: number
}

export const _extractionInstrument: ExtractionInstrument = {
  fontNameMs: 0, fontSizeMs: 0, lineHeightMs: 0, letterSpacingMs: 0, textCaseMs: 0, textDecorationMs: 0, textStyleIdMs: 0,
  fontNameAccesses: 0, fontSizeAccesses: 0, lineHeightAccesses: 0, letterSpacingAccesses: 0, textCaseAccesses: 0, textDecorationAccesses: 0, textStyleIdAccesses: 0,
  getRangeFontNameCalls: 0, getRangeFontSizeCalls: 0, getRangeLineHeightCalls: 0, getRangeLetterSpacingCalls: 0, getRangeTextCaseCalls: 0, getRangeTextDecorationCalls: 0,
  sharedPluginDataAccesses: 0, variableLookups: 0,
}

export function resetExtractionInstrument(): void {
  const e = _extractionInstrument
  e.fontNameMs = 0; e.fontSizeMs = 0; e.lineHeightMs = 0; e.letterSpacingMs = 0; e.textCaseMs = 0; e.textDecorationMs = 0; e.textStyleIdMs = 0
  e.fontNameAccesses = 0; e.fontSizeAccesses = 0; e.lineHeightAccesses = 0; e.letterSpacingAccesses = 0; e.textCaseAccesses = 0; e.textDecorationAccesses = 0; e.textStyleIdAccesses = 0
  e.getRangeFontNameCalls = 0; e.getRangeFontSizeCalls = 0; e.getRangeLineHeightCalls = 0; e.getRangeLetterSpacingCalls = 0; e.getRangeTextCaseCalls = 0; e.getRangeTextDecorationCalls = 0
  e.sharedPluginDataAccesses = 0; e.variableLookups = 0
}

// ---------------------------------------------------------------------------
// Baseline extractor (benchmark tooling only)
// ---------------------------------------------------------------------------

export function extractPropertiesBaseline(node: TextNode): TypographyProperties | null {
  try {
    const fontName: FontName = node.fontName === figma.mixed ? (node.getRangeFontName(0,1) as FontName) : (node.fontName as FontName)
    const fontSize: number   = node.fontSize === figma.mixed ? (node.getRangeFontSize(0,1) as number)   : (node.fontSize as number)
    const rawLH = node.lineHeight   === figma.mixed ? (node.getRangeLineHeight(0,1)   as LineHeight)   : (node.lineHeight   as LineHeight)
    const rawLS = node.letterSpacing === figma.mixed ? (node.getRangeLetterSpacing(0,1) as LetterSpacing) : (node.letterSpacing as LetterSpacing)
    const rawTC = node.textCase     === figma.mixed ? (node.getRangeTextCase(0,1)     as TextCase)     : (node.textCase     as TextCase)
    const rawTD = node.textDecoration === figma.mixed ? (node.getRangeTextDecoration(0,1) as TextDecoration) : (node.textDecoration as TextDecoration)
    const lineHeight: NormalizedLineHeight     = rawLH.unit === 'AUTO' ? { unit: 'AUTO', value: 0 } : { unit: rawLH.unit, value: Math.round(rawLH.value * 100) / 100 }
    const letterSpacing: NormalizedLetterSpacing = { unit: rawLS.unit, value: Math.round(rawLS.value * 100) / 100 }
    return { fontFamily: fontName.family, fontStyle: fontName.style, fontWeight: styleToWeight(fontName.style), fontSize: Math.round(fontSize*100)/100, lineHeight, letterSpacing, textCase: rawTC as TypographyProperties['textCase'], textDecoration: rawTD as TypographyProperties['textDecoration'], textStyleId: '', source: { type: 'Raw' } }
  } catch { return null }
}

// ---------------------------------------------------------------------------
// Optimised extractor
// ---------------------------------------------------------------------------

export function extractProperties(node: TextNode): TypographyProperties | null {
  try {
    let _t = Date.now()
    const rawFontName = node.fontName; _extractionInstrument.fontNameMs += Date.now()-_t; _extractionInstrument.fontNameAccesses++
    _t = Date.now(); const rawFontSize = node.fontSize; _extractionInstrument.fontSizeMs += Date.now()-_t; _extractionInstrument.fontSizeAccesses++
    _t = Date.now(); const rawLH = node.lineHeight; _extractionInstrument.lineHeightMs += Date.now()-_t; _extractionInstrument.lineHeightAccesses++
    _t = Date.now(); const rawLS = node.letterSpacing; _extractionInstrument.letterSpacingMs += Date.now()-_t; _extractionInstrument.letterSpacingAccesses++
    _t = Date.now(); const rawTC = node.textCase; _extractionInstrument.textCaseMs += Date.now()-_t; _extractionInstrument.textCaseAccesses++
    _t = Date.now(); const rawTD = node.textDecoration; _extractionInstrument.textDecorationMs += Date.now()-_t; _extractionInstrument.textDecorationAccesses++
    _t = Date.now(); const rawStyleId = node.textStyleId; _extractionInstrument.textStyleIdMs += Date.now()-_t; _extractionInstrument.textStyleIdAccesses++

    const textStyleId: string = rawStyleId === figma.mixed ? '' : (rawStyleId as string) || ''

    let fontName: FontName
    if (rawFontName === figma.mixed) { _extractionInstrument.getRangeFontNameCalls++; fontName = node.getRangeFontName(0,1) as FontName } else { fontName = rawFontName as FontName }
    let fontSize: number
    if (rawFontSize === figma.mixed) { _extractionInstrument.getRangeFontSizeCalls++; fontSize = node.getRangeFontSize(0,1) as number } else { fontSize = rawFontSize as number }
    let lhResolved: LineHeight
    if (rawLH === figma.mixed) { _extractionInstrument.getRangeLineHeightCalls++; lhResolved = node.getRangeLineHeight(0,1) as LineHeight } else { lhResolved = rawLH as LineHeight }
    const lineHeight: NormalizedLineHeight = lhResolved.unit === 'AUTO' ? { unit: 'AUTO', value: 0 } : { unit: lhResolved.unit, value: Math.round(lhResolved.value*100)/100 }
    let lsResolved: LetterSpacing
    if (rawLS === figma.mixed) { _extractionInstrument.getRangeLetterSpacingCalls++; lsResolved = node.getRangeLetterSpacing(0,1) as LetterSpacing } else { lsResolved = rawLS as LetterSpacing }
    const letterSpacing: NormalizedLetterSpacing = { unit: lsResolved.unit, value: Math.round(lsResolved.value*100)/100 }
    let tc: TextCase
    if (rawTC === figma.mixed) { _extractionInstrument.getRangeTextCaseCalls++; tc = node.getRangeTextCase(0,1) as TextCase } else { tc = rawTC as TextCase }
    let td: TextDecoration
    if (rawTD === figma.mixed) { _extractionInstrument.getRangeTextDecorationCalls++; td = node.getRangeTextDecoration(0,1) as TextDecoration } else { td = rawTD as TextDecoration }

    const source = resolveSource(node, textStyleId)

    return { fontFamily: intern(fontName.family), fontStyle: intern(fontName.style), fontWeight: styleToWeight(fontName.style), fontSize: Math.round(fontSize*100)/100, lineHeight, letterSpacing, textCase: tc as TypographyProperties['textCase'], textDecoration: td as TypographyProperties['textDecoration'], textStyleId, source }
  } catch { return null }
}
