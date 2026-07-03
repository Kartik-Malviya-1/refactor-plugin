import type { TypographyProperties, NormalizedLineHeight, NormalizedLetterSpacing } from './types'
import type { TypographySource } from '../../shared/typography-source'
import { styleToWeight } from './normalizer'
import { intern } from '../../engine/traversal'

// ---------------------------------------------------------------------------
// Style cache
//
// Populated by preloadStyleCacheAsync() BEFORE scanning starts.
// figma.getStyleByIdAsync() is the only available style resolution API in
// plugins with documentAccess: "dynamic-page". The synchronous
// figma.getStyleById() does not exist in this API version.
// ---------------------------------------------------------------------------
interface CachedStyle {
  name:    string
  remote:  boolean
  key:     string
  // Captured at resolve time so GET_PLANNING_DATA needs no extra API calls
  fontFamily?: string
  fontStyle?:  string
  fontSize?:   number
}

const _styleCache = new Map<string, CachedStyle | null>()

// Cache-only lookup — guaranteed to be pre-populated by preloadStyleCacheAsync()
function resolveStyle(styleId: string): CachedStyle | null {
  if (_styleCache.has(styleId)) return _styleCache.get(styleId)!
  // Style was not in scope or wasn't linked to any text node
  _styleCache.set(styleId, null)
  return null
}

export function clearStyleCache(): void { _styleCache.clear() }

export function getDiscoveredStyles(): ReadonlyMap<string, CachedStyle | null> {
  return _styleCache
}

/**
 * Pre-populate the style cache for the given scan scope.
 *
 * Must be called with `await` in START_SCAN BEFORE scanEngine.run().
 * Traverses text nodes to collect unique textStyleIds, then resolves each
 * one via figma.getStyleByIdAsync() (the only available async style API).
 *
 * For 'file' scope, pages are switched via setCurrentPageAsync so every
 * page is covered; the original page is restored when done.
 */
export async function preloadStyleCacheAsync(scope: string): Promise<void> {
  const styleIds = new Set<string>()

  function collectFromNodes(nodes: ReadonlyArray<SceneNode>): void {
    for (const node of nodes) {
      if (node.type === 'TEXT') {
        const id = (node as TextNode).textStyleId
        // textStyleId is a string when uniform, figma.mixed Symbol when mixed
        if (typeof id === 'string' && id.length > 0) styleIds.add(id)
      }
      if ('children' in node) {
        collectFromNodes((node as ChildrenMixin).children)
      }
    }
  }

  if (scope === 'selection') {
    collectFromNodes(figma.currentPage.selection)
  } else if (scope === 'page') {
    collectFromNodes(figma.currentPage.children)
  } else {
    // file scope — must switch pages in dynamic-page mode to access each page
    const startPage = figma.currentPage
    for (const child of figma.root.children) {
      if (child.type === 'PAGE') {
        await figma.setCurrentPageAsync(child as PageNode)
        collectFromNodes((child as PageNode).children)
      }
    }
    await figma.setCurrentPageAsync(startPage)
  }

  console.log(`[Refactor] preloadStyleCacheAsync: ${styleIds.size} unique textStyleIds (scope="${scope}")`)

  let resolved = 0, unresolved = 0
  for (const styleId of styleIds) {
    if (_styleCache.has(styleId)) { resolved++; continue }
    try {
      const style = await figma.getStyleByIdAsync(styleId)
      if (!style) {
        _styleCache.set(styleId, null)
        unresolved++
        console.log(`[Refactor] preloadStyleCacheAsync: null for id=${styleId} (deleted/missing style)`)
        continue
      }

      let fontFamily: string | undefined
      let fontStyle:  string | undefined
      let fontSize:   number | undefined

      if (style.type === 'TEXT') {
        const ts = style as unknown as TextStyle
        // TextStyle.fontName is always FontName (not mixed) on a style object
        const fn = ts.fontName as FontName
        if (fn && typeof fn.family === 'string') {
          fontFamily = fn.family
          fontStyle  = fn.style
        }
        // TextStyle.fontSize is always number (not mixed) on a style object
        if (typeof ts.fontSize === 'number') fontSize = ts.fontSize
      }

      _styleCache.set(styleId, {
        name: style.name, remote: style.remote, key: style.key,
        fontFamily, fontStyle, fontSize,
      })
      resolved++
    } catch (err) {
      _styleCache.set(styleId, null)
      unresolved++
      console.log(`[Refactor] preloadStyleCacheAsync: error id=${styleId}: ${String(err)}`)
    }
  }

  const entries    = [..._styleCache.values()]
  const libCount   = entries.filter(c => c && c.remote).length
  const localCount = entries.filter(c => c && !c.remote).length
  console.log(`[Refactor] preloadStyleCacheAsync complete: resolved=${resolved} unresolved=${unresolved} local=${localCount} library=${libCount}`)
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
