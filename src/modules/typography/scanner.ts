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
  // Total onProgress calls dispatched during the scan.
  // Shows the before/after impact of time-based throttling.
  progressEventCount: 0,
  benchSampleSize: 0,
  benchBaselineMsPerNode: 0,
  benchOptimizedMsPerNode: 0,
}

// Yield to the event loop every N nodes to keep the plugin thread responsive.
const YIELD_EVERY = 200

// Minimum elapsed time between progress sends.
// Decouples UI update frequency from node count so message volume
// is bounded by scan duration rather than file size.
// At 150ms: ~6–7 updates/second — smooth for a progress bar.
const PROGRESS_THROTTLE_MS = 150

const BENCH_SAMPLE = 20

// ---------------------------------------------------------------------------
// String intern pool
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
  // Reset per-scan counters.
  _scanTimings.progressEventCount = 0

  // Helper that sends a progress event and increments the counter.
  function sendProgress(p: ScanProgress): void {
    onProgress?.(p)
    _scanTimings.progressEventCount++
  }

  sendProgress({ current: 0, total: 0, phase: 'collecting', label: 'Collecting text layers…' })

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
      // One progress event per page during traversal — not throttled because
      // page count is bounded and the label update is meaningful here.
      sendProgress({
        current: 0,
        total: 0,
        phase: 'collecting',
        label: `Loading page "${page.name}"…`,
      })

      const countBefore = textNodes.length
      findTextNodes(page, textNodes)

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

  const currentPageId   = figma.currentPage.id
  const currentPageName = intern(figma.currentPage.name)

  // Tracks when the last progress event was sent.
  // The extraction loop yields every YIELD_EVERY nodes but only sends
  // a progress update when PROGRESS_THROTTLE_MS have elapsed, decoupling
  // UI update rate from file size.
  let lastProgressAt = Date.now()

  for (let i = 0; i < textNodes.length; i++) {
    if (i % YIELD_EVERY === 0) {
      // Always yield — keeps plugin thread responsive and allows cancellation.
      await new Promise<void>((r) => setTimeout(r, 0))

      // Only send a progress event if enough time has elapsed.
      // This bounds message volume to ~scan_duration / PROGRESS_THROTTLE_MS
      // regardless of how many nodes are in the file.
      const now = Date.now()
      if (now - lastProgressAt >= PROGRESS_THROTTLE_MS) {
        sendProgress({ current: i, total, phase: 'analyzing', label: `Analyzing ${i} of ${total}…` })
        lastProgressAt = now
      }
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

  // Guarantee one final progress event at 100% so the UI always
  // transitions through completion before SCAN_COMPLETE arrives.
  sendProgress({ current: total, total, phase: 'grouping', label: 'Grouping results…' })

  _scanTimings.extractionMs = Date.now() - tExtractionStart

  // Release TextNode proxy references before the grouping phase.
  textNodes.length = 0

  return items
}
