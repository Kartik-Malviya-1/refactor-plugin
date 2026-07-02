import type { AuditItem, ScanProgress, ScanScope } from '../../shared/types'
import type { TypographyProperties, NormalizedLineHeight, NormalizedLetterSpacing } from './types'
import { styleToWeight } from './normalizer'

// ---------------------------------------------------------------------------
// Profiling data — populated during every scanTypography() call.
// ---------------------------------------------------------------------------
export const _scanTimings = {
  traversalMs: 0,
  extractionMs: 0,
  nodeCount: 0,
  benchSampleSize: 0,
  benchBaselineMsPerNode: 0,
  benchOptimizedMsPerNode: 0,
}

const BENCH_SAMPLE = 20

// ---------------------------------------------------------------------------
// String intern pool
//
// Font families ("Inter"), font styles ("Regular"), page names, and parent
// frame names repeat across thousands of nodes. Each Figma bridge property
// access returns a new JS string object even when the value is identical.
// Without interning: 50K nodes using "Inter" = 50K separate string objects.
// With interning:    50K nodes using "Inter" = 1 string object, shared.
//
// The pool is module-level so it stays warm across rescans in the same
// plugin session. Its size is bounded by the number of unique string values
// ever seen (font families + styles + page names — typically < 200 entries).
// ---------------------------------------------------------------------------
const _stringPool = new Map<string, string>()

function intern(s: string): string {
  const hit = _stringPool.get(s)
  if (hit !== undefined) return hit
  _stringPool.set(s, s)
  return s
}

// ---------------------------------------------------------------------------
// Tree traversal
// ---------------------------------------------------------------------------

function findTextNodes(node: BaseNode, results: TextNode[] = []): TextNode[] {
  if (node.type === 'TEXT') {
    results.push(node as TextNode)
    return results
  }
  if ('children' in node) {
    for (const child of (node as ChildrenMixin).children) {
      findTextNodes(child, results)
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// BASELINE extractor — original double-access pattern.
// Not used for the actual scan; only called by the benchmark loop.
// ---------------------------------------------------------------------------

function extractPropertiesBaseline(node: TextNode): TypographyProperties | null {
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
// ---------------------------------------------------------------------------

function extractProperties(node: TextNode): TypographyProperties | null {
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
      // intern() deduplicates repeated string values across nodes.
      // All nodes using "Inter Regular" share the same two string objects.
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

// ---------------------------------------------------------------------------
// Public scanner
// ---------------------------------------------------------------------------

type PageInfo = { pageId: string; pageName: string }

export async function scanTypography(
  scope: ScanScope,
  onProgress?: (p: ScanProgress) => void
): Promise<AuditItem<TypographyProperties>[]> {
  onProgress?.({ current: 0, total: 0, phase: 'collecting', label: 'Collecting text layers…' })

  // ── Stage: Traversal ────────────────────────────────────────────────────
  const tTraversalStart = Date.now()

  const textNodes: TextNode[] = []
  const nodeToPage = new Map<string, PageInfo>()

  if (scope === 'selection') {
    const sel = figma.currentPage.selection
    if (sel.length === 0) {
      _scanTimings.traversalMs = Date.now() - tTraversalStart
      _scanTimings.extractionMs = 0
      _scanTimings.nodeCount = 0
      _scanTimings.benchSampleSize = 0
      return []
    }
    for (const node of sel) {
      findTextNodes(node, textNodes)
    }
  } else if (scope === 'page') {
    findTextNodes(figma.currentPage, textNodes)
  } else {
    await figma.loadAllPagesAsync()
    for (const page of figma.root.children) {
      onProgress?.({
        current: 0,
        total: 0,
        phase: 'collecting',
        label: `Loading page "${page.name}"…`,
      })

      const countBefore = textNodes.length
      findTextNodes(page, textNodes)

      // Intern the page name once per page rather than once per node.
      const pageInfo: PageInfo = { pageId: page.id, pageName: intern(page.name) }
      for (let i = countBefore; i < textNodes.length; i++) {
        nodeToPage.set(textNodes[i].id, pageInfo)
      }
    }
  }

  _scanTimings.traversalMs = Date.now() - tTraversalStart
  _scanTimings.nodeCount = textNodes.length

  // ── Before/After micro-benchmark ─────────────────────────────────────────
  const sampleN = Math.min(BENCH_SAMPLE, textNodes.length)

  const tBenchOld = Date.now()
  for (let i = 0; i < sampleN; i++) {
    extractPropertiesBaseline(textNodes[i])
  }
  const benchOldMs = Date.now() - tBenchOld

  const tBenchNew = Date.now()
  for (let i = 0; i < sampleN; i++) {
    extractProperties(textNodes[i])
  }
  const benchNewMs = Date.now() - tBenchNew

  _scanTimings.benchSampleSize = sampleN
  _scanTimings.benchBaselineMsPerNode = sampleN > 0 ? benchOldMs / sampleN : 0
  _scanTimings.benchOptimizedMsPerNode = sampleN > 0 ? benchNewMs / sampleN : 0

  // ── Stage: Extraction (optimised path) ───────────────────────────────────
  const tExtractionStart = Date.now()

  const total = textNodes.length
  const items: AuditItem<TypographyProperties>[] = []

  // Intern the current page name once for selection/page scope.
  const currentPageId   = figma.currentPage.id
  const currentPageName = intern(figma.currentPage.name)

  for (let i = 0; i < textNodes.length; i++) {
    if (i % 200 === 0) {
      onProgress?.({ current: i, total, phase: 'analyzing', label: `Analyzing ${i} of ${total}…` })
      await new Promise<void>((r) => setTimeout(r, 0))
    }

    const node = textNodes[i]
    const props = extractProperties(node)
    if (!props) continue

    const { pageId, pageName } =
      scope === 'file'
        ? (nodeToPage.get(node.id) ?? { pageId: currentPageId, pageName: currentPageName })
        : { pageId: currentPageId, pageName: currentPageName }

    let parentName: string | undefined
    if (node.parent && node.parent.type !== 'PAGE') {
      // intern() ensures all nodes inside the same parent share one string object.
      parentName = intern(node.parent.name)
    }

    items.push({
      id: `typography:${node.id}`,
      nodeId: node.id,
      nodeName: node.name,
      pageId,
      pageName,
      parentName,
      properties: props,
    })
  }

  _scanTimings.extractionMs = Date.now() - tExtractionStart

  // Release TextNode proxy references so GC can reclaim them before
  // the grouping phase creates its own memory pressure.
  textNodes.length = 0

  onProgress?.({ current: total, total, phase: 'grouping', label: 'Grouping results…' })

  return items
}
