import type { AuditItem, ScanProgress, ScanScope } from '../shared/types'
import type { ScannerAdapter } from './types'

// ---------------------------------------------------------------------------
// String intern pool
// ---------------------------------------------------------------------------
const _stringPool = new Map<string, string>()

export function intern(s: string): string {
  const hit = _stringPool.get(s)
  if (hit !== undefined) return hit
  _stringPool.set(s, s)
  return s
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Total nodes visited between async yields during traversal.
 * Covers text + non-text nodes. 500 nodes ≈ 1–5ms of traversal work,
 * keeping the plugin thread responsive without excessive yield overhead.
 */
const TRAVERSAL_CHUNK = 500

/** Nodes extracted between async yields during the extraction phase. */
const YIELD_EVERY = 200

/** Minimum elapsed time between progress events sent to the UI. */
const PROGRESS_THROTTLE_MS = 150

// ---------------------------------------------------------------------------
// Iterative DFS node collector
//
// Replaces the former recursive collectNodes().
//
// Why iterative:
// 1. Stack safety — deeply nested component hierarchies (component inside
//    component inside frame, many levels deep) will eventually overflow
//    the JS call stack with recursive DFS. An explicit stack is unbounded.
// 2. Yield points — a recursive function cannot suspend mid-execution.
//    The iterative loop can yield every TRAVERSAL_CHUNK nodes, keeping
//    the plugin thread responsive and allowing cancel signals to be
//    processed between bursts.
//
// DFS order is preserved: children are pushed in reverse order so the
// first child is popped first, matching left-to-right document order.
//
// Returns true if cancelled, false if traversal completed normally.
// ---------------------------------------------------------------------------

async function collectNodesIterative<TNode extends BaseNode>(
  root: BaseNode,
  accepts: (node: BaseNode) => node is TNode,
  results: TNode[],
  isCancelled: () => boolean
): Promise<boolean> {
  const stack: BaseNode[] = [root]
  let visited = 0

  while (stack.length > 0) {
    const node = stack.pop()!
    visited++

    if (accepts(node)) {
      results.push(node)
    }

    if ('children' in node) {
      // Push in reverse order to maintain left-to-right DFS visit order.
      const children = (node as ChildrenMixin).children
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push(children[i])
      }
    }

    if (visited % TRAVERSAL_CHUNK === 0) {
      await new Promise<void>((r) => setTimeout(r, 0))
      if (isCancelled()) return true
    }
  }

  return false
}

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
// Public entry point
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

  const empty = (traversalMs: number): TraversalResult<TProperties> => ({
    items: [],
    traversalMs,
    extractionMs: 0,
    nodeCount: 0,
    progressEventCount,
  })

  sendProgress({ current: 0, total: 0, phase: 'collecting', label: 'Collecting layers…' })

  // ── Traversal ────────────────────────────────────────────────────
  const tTraversalStart = Date.now()

  const matchedNodes: TNode[] = []
  const nodeToPage = new Map<string, PageInfo>()

  if (scope === 'selection') {
    const sel = figma.currentPage.selection
    if (sel.length === 0) {
      return empty(Date.now() - tTraversalStart)
    }
    for (const node of sel) {
      const cancelled = await collectNodesIterative(node, adapter.accepts, matchedNodes, isCancelled)
      if (cancelled) return empty(Date.now() - tTraversalStart)
    }
  } else if (scope === 'page') {
    const cancelled = await collectNodesIterative(
      figma.currentPage,
      adapter.accepts,
      matchedNodes,
      isCancelled
    )
    if (cancelled) return empty(Date.now() - tTraversalStart)
  } else {
    // file scope: load every page, traverse each, tag nodes with their page.
    await figma.loadAllPagesAsync()

    for (const page of figma.root.children) {
      if (isCancelled()) return empty(Date.now() - tTraversalStart)

      sendProgress({
        current: 0,
        total: 0,
        phase: 'collecting',
        label: `Traversing page "${page.name}"…`,
      })

      const countBefore = matchedNodes.length
      const cancelled = await collectNodesIterative(page, adapter.accepts, matchedNodes, isCancelled)
      if (cancelled) return empty(Date.now() - tTraversalStart)

      // Tag every newly collected node with this page's info in O(1).
      // Eliminates the former O(N²) per-node page search.
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
      // Always yield — keeps plugin thread responsive regardless of
      // whether a progress update is due.
      await new Promise<void>((r) => setTimeout(r, 0))

      if (isCancelled()) {
        return {
          items: [],
          traversalMs,
          extractionMs: Date.now() - tExtractionStart,
          nodeCount,
          progressEventCount,
        }
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

  // Guaranteed final progress event at 100% before returning.
  sendProgress({ current: total, total, phase: 'grouping', label: 'Grouping results…' })

  const extractionMs = Date.now() - tExtractionStart

  // Release matched node proxy references before the grouping phase.
  matchedNodes.length = 0

  return { items, traversalMs, extractionMs, nodeCount, progressEventCount }
}
