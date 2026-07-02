import type { AuditItem, ScanProgress, ScanScope } from '../shared/types'
import type { ScannerAdapter } from './types'

// ---------------------------------------------------------------------------
// String intern pool
//
// Shared across all engine traversal calls and by module extractors
// (scanner.ts imports intern from here).
// Deduplicates repeated string values: page names, parent names, font
// families, font styles. At 500K nodes, without interning each bridge
// property access returns a fresh string object even for identical values.
// With interning: all nodes using "Inter" share one JS string object.
// ---------------------------------------------------------------------------
const _stringPool = new Map<string, string>()

export function intern(s: string): string {
  const hit = _stringPool.get(s)
  if (hit !== undefined) return hit
  _stringPool.set(s, s)
  return s
}

// ---------------------------------------------------------------------------
// Traversal constants
// ---------------------------------------------------------------------------

/** Nodes processed between async yields. Keeps the plugin thread responsive. */
const YIELD_EVERY = 200

/** Minimum elapsed time between progress events sent to the UI. */
const PROGRESS_THROTTLE_MS = 150

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageInfo = { pageId: string; pageName: string }

export interface TraversalResult<TProperties> {
  items: AuditItem<TProperties>[]
  traversalMs: number
  extractionMs: number
  nodeCount: number
  progressEventCount: number
}

// ---------------------------------------------------------------------------
// Generic node collector — iterates the subtree under root, collecting
// all nodes for which accepts() returns true.
// ---------------------------------------------------------------------------

function collectNodes<TNode extends BaseNode>(
  root: BaseNode,
  accepts: (node: BaseNode) => node is TNode,
  results: TNode[]
): void {
  if (accepts(root)) {
    results.push(root)
  }
  if ('children' in root) {
    for (const child of (root as ChildrenMixin).children) {
      collectNodes(child, accepts, results)
    }
  }
}

// ---------------------------------------------------------------------------
// Public entry point: traverses the document for the given scope,
// applies the adapter's accepts/extract pair, and returns AuditItems.
// ---------------------------------------------------------------------------

export async function traverseAndExtract<TNode extends BaseNode, TProperties>(
  adapter: ScannerAdapter<TNode, TProperties>,
  scope: ScanScope,
  isCancelled: () => boolean,
  onProgress?: (p: ScanProgress) => void
): Promise<TraversalResult<TProperties>> {
  let progressEventCount = 0

  function sendProgress(p: ScanProgress): void {
    onProgress?.(p)
    progressEventCount++
  }

  sendProgress({ current: 0, total: 0, phase: 'collecting', label: 'Collecting layers…' })

  // ── Traversal ────────────────────────────────────────────────────
  const tTraversalStart = Date.now()

  const matchedNodes: TNode[] = []
  const nodeToPage = new Map<string, PageInfo>()

  if (scope === 'selection') {
    const sel = figma.currentPage.selection
    if (sel.length === 0) {
      return { items: [], traversalMs: Date.now() - tTraversalStart, extractionMs: 0, nodeCount: 0, progressEventCount }
    }
    for (const node of sel) {
      collectNodes(node, adapter.accepts, matchedNodes)
    }
  } else if (scope === 'page') {
    collectNodes(figma.currentPage, adapter.accepts, matchedNodes)
  } else {
    // file scope: load every page, tag each collected node with its page.
    await figma.loadAllPagesAsync()
    for (const page of figma.root.children) {
      if (isCancelled()) {
        return { items: [], traversalMs: Date.now() - tTraversalStart, extractionMs: 0, nodeCount: 0, progressEventCount }
      }
      sendProgress({ current: 0, total: 0, phase: 'collecting', label: `Loading page "${page.name}"…` })

      const countBefore = matchedNodes.length
      collectNodes(page, adapter.accepts, matchedNodes)

      // Tag newly found nodes with this page's info in O(1).
      // Eliminates the former O(N²) findPageForNode() pattern.
      const pageInfo: PageInfo = { pageId: page.id, pageName: intern(page.name) }
      for (let i = countBefore; i < matchedNodes.length; i++) {
        nodeToPage.set(matchedNodes[i].id, pageInfo)
      }
    }
  }

  const traversalMs = Date.now() - tTraversalStart
  const nodeCount = matchedNodes.length

  // ── Extraction ───────────────────────────────────────────────────
  const tExtractionStart = Date.now()

  const total = matchedNodes.length
  const items: AuditItem<TProperties>[] = []

  const currentPageId   = figma.currentPage.id
  const currentPageName = intern(figma.currentPage.name)

  let lastProgressAt = Date.now()

  for (let i = 0; i < matchedNodes.length; i++) {
    if (i % YIELD_EVERY === 0) {
      await new Promise<void>((r) => setTimeout(r, 0))

      if (isCancelled()) {
        return { items: [], traversalMs, extractionMs: Date.now() - tExtractionStart, nodeCount, progressEventCount }
      }

      const now = Date.now()
      if (now - lastProgressAt >= PROGRESS_THROTTLE_MS) {
        sendProgress({ current: i, total, phase: 'analyzing', label: `Analyzing ${i} of ${total}…` })
        lastProgressAt = now
      }
    }

    const node = matchedNodes[i]
    const props = adapter.extract(node)
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
      id: `${adapter.moduleId}:${node.id}`,
      nodeId: node.id,
      nodeName: node.name,
      pageId,
      pageName,
      parentName,
      properties: props,
    })
  }

  // Guaranteed final progress at 100% before returning.
  sendProgress({ current: total, total, phase: 'grouping', label: 'Grouping results…' })

  const extractionMs = Date.now() - tExtractionStart

  // Release matched node references before grouping phase begins.
  matchedNodes.length = 0

  return { items, traversalMs, extractionMs, nodeCount, progressEventCount }
}
