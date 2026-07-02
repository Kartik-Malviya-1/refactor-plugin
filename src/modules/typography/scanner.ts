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
  // Before/after benchmark (populated by the micro-benchmark in scanTypography)
  benchSampleSize: 0,
  benchBaselineMsPerNode: 0,   // double-access approach (before optimisation)
  benchOptimizedMsPerNode: 0,  // single-cache approach  (after optimisation)
}

// How many nodes to sample for the before/after micro-benchmark.
// Small enough not to distort the profiler; large enough to be meaningful.
const BENCH_SAMPLE = 20

// ---------------------------------------------------------------------------
// Tree traversal (unchanged)
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
//
// Kept here so the micro-benchmark can measure the real before/after delta
// on the same nodes, in the same environment, in the same run.
// NOT used for the actual scan; only called by the benchmark loop.
//
// The problem: every property is evaluated twice in the non-mixed path —
// once for `=== figma.mixed` and once to read the value. Each evaluation
// is a synchronous IPC call from the plugin sandbox to the Figma main thread.
// ---------------------------------------------------------------------------

function extractPropertiesBaseline(node: TextNode): TypographyProperties | null {
  try {
    const fontName: FontName =
      node.fontName === figma.mixed          // IPC call 1
        ? (node.getRangeFontName(0, 1) as FontName)
        : (node.fontName as FontName)        // IPC call 2 (redundant)

    const fontSize: number =
      node.fontSize === figma.mixed          // IPC call 3
        ? (node.getRangeFontSize(0, 1) as number)
        : (node.fontSize as number)          // IPC call 4 (redundant)

    const rawLH: LineHeight =
      node.lineHeight === figma.mixed        // IPC call 5
        ? (node.getRangeLineHeight(0, 1) as LineHeight)
        : (node.lineHeight as LineHeight)    // IPC call 6 (redundant)

    const rawLS: LetterSpacing =
      node.letterSpacing === figma.mixed     // IPC call 7
        ? (node.getRangeLetterSpacing(0, 1) as LetterSpacing)
        : (node.letterSpacing as LetterSpacing) // IPC call 8 (redundant)

    const rawTC: TextCase =
      node.textCase === figma.mixed          // IPC call 9
        ? (node.getRangeTextCase(0, 1) as TextCase)
        : (node.textCase as TextCase)        // IPC call 10 (redundant)

    const rawTD: TextDecoration =
      node.textDecoration === figma.mixed    // IPC call 11
        ? (node.getRangeTextDecoration(0, 1) as TextDecoration)
        : (node.textDecoration as TextDecoration) // IPC call 12 (redundant)

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
// Fix: cache each node.property into a local variable before the
// figma.mixed guard. The non-mixed path (the vast majority of text nodes)
// now makes 1 IPC call per field instead of 2.
//
// For 400 nodes: 400 × 6 fields × 1 saved call = 2,400 fewer IPC round-trips.
// ---------------------------------------------------------------------------

function extractProperties(node: TextNode): TypographyProperties | null {
  try {
    // Read each property once; reuse the cached JS value for the guard.
    const rawFontName = node.fontName         // 1 IPC call (was 2)
    const rawFontSize = node.fontSize         // 1 IPC call (was 2)
    const rawLH       = node.lineHeight       // 1 IPC call (was 2)
    const rawLS       = node.letterSpacing    // 1 IPC call (was 2)
    const rawTC       = node.textCase         // 1 IPC call (was 2)
    const rawTD       = node.textDecoration   // 1 IPC call (was 2)

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
      fontFamily: fontName.family,
      fontStyle: fontName.style,
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

function findPageForNode(nodeId: string): { pageId: string; pageName: string } {
  for (const page of figma.root.children) {
    const found = page.findOne((n: BaseNode) => n.id === nodeId)
    if (found) return { pageId: page.id, pageName: page.name }
  }
  return { pageId: figma.currentPage.id, pageName: figma.currentPage.name }
}

// ---------------------------------------------------------------------------
// Public scanner
// ---------------------------------------------------------------------------

export async function scanTypography(
  scope: ScanScope,
  onProgress?: (p: ScanProgress) => void
): Promise<AuditItem<TypographyProperties>[]> {
  onProgress?.({ current: 0, total: 0, phase: 'collecting', label: 'Collecting text layers…' })

  // ── Stage: Traversal ────────────────────────────────────────────────────
  const tTraversalStart = Date.now()

  const textNodes: TextNode[] = []

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
      findTextNodes(page, textNodes)
    }
  }

  _scanTimings.traversalMs = Date.now() - tTraversalStart
  _scanTimings.nodeCount = textNodes.length

  // ── Before/After micro-benchmark ─────────────────────────────────────────
  // Runs both extractors on the same BENCH_SAMPLE nodes so the console output
  // shows a measured before/after on real data from this file, not estimates.
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
  const currentPageId = figma.currentPage.id
  const currentPageName = figma.currentPage.name

  for (let i = 0; i < textNodes.length; i++) {
    if (i % 200 === 0) {
      onProgress?.({ current: i, total, phase: 'analyzing', label: `Analyzing ${i} of ${total}…` })
      await new Promise<void>((r) => setTimeout(r, 0))
    }

    const node = textNodes[i]
    const props = extractProperties(node)   // <─ optimised path
    if (!props) continue

    const pageId = scope === 'file' ? findPageForNode(node.id).pageId : currentPageId
    const pageName = scope === 'file' ? findPageForNode(node.id).pageName : currentPageName

    let parentName: string | undefined
    if (node.parent && node.parent.type !== 'PAGE') {
      parentName = node.parent.name
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

  onProgress?.({ current: total, total, phase: 'grouping', label: 'Grouping results…' })

  return items
}
