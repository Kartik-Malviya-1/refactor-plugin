import type { AuditItem, ScanProgress, ScanScope } from '../../shared/types'
import type { TypographyProperties, NormalizedLineHeight, NormalizedLetterSpacing } from './types'
import { styleToWeight } from './normalizer'

// ---------------------------------------------------------------------------
// Profiling data — populated during every scanTypography() call.
// Read by src/plugin/main.ts after the call returns to build the report.
// ---------------------------------------------------------------------------
export const _scanTimings = {
  traversalMs: 0,
  extractionMs: 0,
  nodeCount: 0,
}

// ---------------------------------------------------------------------------
// Internals
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

function extractProperties(node: TextNode): TypographyProperties | null {
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

function findPageForNode(nodeId: string): { pageId: string; pageName: string } {
  for (const page of figma.root.children) {
    const found = page.findOne((n: BaseNode) => n.id === nodeId)
    if (found) return { pageId: page.id, pageName: page.name }
  }
  return { pageId: figma.currentPage.id, pageName: figma.currentPage.name }
}

// ---------------------------------------------------------------------------
// Public scanner — unchanged behaviour; timing data written to _scanTimings
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

  // ── Stage: Extraction ───────────────────────────────────────────────────
  // Includes async yields (setTimeout(r, 0)) every 200 nodes to avoid
  // blocking the plugin thread. Yield time is counted here intentionally
  // because it is dead time caused by this phase.
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
    const props = extractProperties(node)
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
