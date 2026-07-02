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

const TRAVERSAL_CHUNK = 500
const YIELD_EVERY = 200
const PROGRESS_THROTTLE_MS = 150

// ---------------------------------------------------------------------------
// Instrumentation
//
// Counters and timers for the traversal and extraction phases.
// Reset automatically at the start of every traverseAndExtract() call.
// Read by main.ts after the scan to print the detailed report.
// ---------------------------------------------------------------------------

export interface TraversalInstrument {
  // Stage 1: Document traversal
  traversalMs: number
  nodesVisited: number       // all DFS nodes popped (frames + groups + text + etc.)
  nodesMatched: number       // nodes for which adapter.accepts() returned true

  // Stage 2: Page lookup (Map.get per node)
  pageLookupMs: number
  pageLookupCount: number

  // Stage 3: Text extraction (total time inside adapter.extract() per node)
  extractionCallMs: number
  itemsExtracted: number     // non-null results returned by adapter.extract()

  // Parent access (node.parent IPC call + .type check + .name access)
  parentAccessMs: number
  parentAccessCount: number

  // Progress updates
  progressUpdateCount: number
}

export const _traversalInstrument: TraversalInstrument = {
  traversalMs: 0,
  nodesVisited: 0,
  nodesMatched: 0,
  pageLookupMs: 0,
  pageLookupCount: 0,
  extractionCallMs: 0,
  itemsExtracted: 0,
  parentAccessMs: 0,
  parentAccessCount: 0,
  progressUpdateCount: 0,
}

function resetTraversalInstrument(): void {
  _traversalInstrument.traversalMs = 0
  _traversalInstrument.nodesVisited = 0
  _traversalInstrument.nodesMatched = 0
  _traversalInstrument.pageLookupMs = 0
  _traversalInstrument.pageLookupCount = 0
  _traversalInstrument.extractionCallMs = 0
  _traversalInstrument.itemsExtracted = 0
  _traversalInstrument.parentAccessMs = 0
  _traversalInstrument.parentAccessCount = 0
  _traversalInstrument.progressUpdateCount = 0
}

// ---------------------------------------------------------------------------
// Iterative DFS node collector
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
    _traversalInstrument.nodesVisited++   // instrument: total DFS nodes

    if (accepts(node)) {
      results.push(node)
      _traversalInstrument.nodesMatched++ // instrument: matched nodes
    }

    if ('children' in node) {
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
  // Reset all traversal instrumentation for this scan.
  resetTraversalInstrument()

  function sendProgress(p: ScanProgress): void {
    onProgress?.(p)
    _traversalInstrument.progressUpdateCount++  // instrument
  }

  const empty = (traversalMs: number): TraversalResult<TProperties> => ({
    items: [],
    traversalMs,
    extractionMs: 0,
    nodeCount: 0,
    progressEventCount: _traversalInstrument.progressUpdateCount,
  })

  sendProgress({ current: 0, total: 0, phase: 'collecting', label: 'Collecting layers…' })

  // ── Stage 1: Document traversal ──────────────────────────────────
  const tTraversalStart = Date.now()

  const matchedNodes: TNode[] = []
  const nodeToPage = new Map<string, PageInfo>()

  if (scope === 'selection') {
    const sel = figma.currentPage.selection
    if (sel.length === 0) {
      _traversalInstrument.traversalMs = Date.now() - tTraversalStart
      return empty(_traversalInstrument.traversalMs)
    }
    for (const node of sel) {
      const cancelled = await collectNodesIterative(node, adapter.accepts, matchedNodes, isCancelled)
      if (cancelled) {
        _traversalInstrument.traversalMs = Date.now() - tTraversalStart
        return empty(_traversalInstrument.traversalMs)
      }
    }
  } else if (scope === 'page') {
    const cancelled = await collectNodesIterative(
      figma.currentPage, adapter.accepts, matchedNodes, isCancelled
    )
    if (cancelled) {
      _traversalInstrument.traversalMs = Date.now() - tTraversalStart
      return empty(_traversalInstrument.traversalMs)
    }
  } else {
    await figma.loadAllPagesAsync()
    for (const page of figma.root.children) {
      if (isCancelled()) {
        _traversalInstrument.traversalMs = Date.now() - tTraversalStart
        return empty(_traversalInstrument.traversalMs)
      }
      sendProgress({ current: 0, total: 0, phase: 'collecting', label: `Traversing page "${page.name}"…` })
      const countBefore = matchedNodes.length
      const cancelled = await collectNodesIterative(page, adapter.accepts, matchedNodes, isCancelled)
      if (cancelled) {
        _traversalInstrument.traversalMs = Date.now() - tTraversalStart
        return empty(_traversalInstrument.traversalMs)
      }
      const pageInfo: PageInfo = { pageId: page.id, pageName: intern(page.name) }
      for (let i = countBefore; i < matchedNodes.length; i++) {
        nodeToPage.set(matchedNodes[i].id, pageInfo)
      }
    }
  }

  _traversalInstrument.traversalMs = Date.now() - tTraversalStart
  const nodeCount = matchedNodes.length

  // ── Stages 2–3: Extraction loop ────────────────────────────────────
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
        return {
          items: [],
          traversalMs: _traversalInstrument.traversalMs,
          extractionMs: Date.now() - tExtractionStart,
          nodeCount,
          progressEventCount: _traversalInstrument.progressUpdateCount,
        }
      }
      const now = Date.now()
      if (now - lastProgressAt >= PROGRESS_THROTTLE_MS) {
        sendProgress({ current: i, total, phase: 'analyzing', label: `Analyzing ${i} of ${total}…` })
        lastProgressAt = now
      }
    }

    const node = matchedNodes[i]

    // ── Stage 3: Text extraction (time inside adapter.extract) ─────────
    const _tExtract = Date.now()
    const props = adapter.extract(node)
    _traversalInstrument.extractionCallMs += Date.now() - _tExtract

    if (!props) continue
    _traversalInstrument.itemsExtracted++

    // ── Stage 2: Page lookup (Map.get — O(1)) ─────────────────────
    const _tPage = Date.now()
    const { pageId, pageName } =
      scope === 'file'
        ? (nodeToPage.get(node.id) ?? { pageId: currentPageId, pageName: currentPageName })
        : { pageId: currentPageId, pageName: currentPageName }
    _traversalInstrument.pageLookupMs += Date.now() - _tPage
    _traversalInstrument.pageLookupCount++

    // ── Parent access (node.parent IPC call) ───────────────────────
    const _tParent = Date.now()
    const nodeParent = node.parent   // IPC call: crosses sandbox boundary
    let parentName: string | undefined
    if (nodeParent && nodeParent.type !== 'PAGE') {
      parentName = intern(nodeParent.name)
    }
    _traversalInstrument.parentAccessMs += Date.now() - _tParent
    _traversalInstrument.parentAccessCount++

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

  sendProgress({ current: total, total, phase: 'grouping', label: 'Grouping results…' })

  const extractionMs = Date.now() - tExtractionStart
  matchedNodes.length = 0

  return {
    items,
    traversalMs: _traversalInstrument.traversalMs,
    extractionMs,
    nodeCount,
    progressEventCount: _traversalInstrument.progressUpdateCount,
  }
}
