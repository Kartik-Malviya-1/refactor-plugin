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
// ---------------------------------------------------------------------------

export interface TraversalInstrument {
  traversalMs: number
  nodesVisited: number
  nodesMatched: number
  pageLookupMs: number
  pageLookupCount: number
  extractionCallMs: number
  itemsExtracted: number
  parentAccessMs: number
  parentAccessCount: number
  progressUpdateCount: number
}

export const _traversalInstrument: TraversalInstrument = {
  traversalMs: 0, nodesVisited: 0, nodesMatched: 0,
  pageLookupMs: 0, pageLookupCount: 0,
  extractionCallMs: 0, itemsExtracted: 0,
  parentAccessMs: 0, parentAccessCount: 0,
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
    _traversalInstrument.nodesVisited++

    if (accepts(node)) {
      results.push(node)
      _traversalInstrument.nodesMatched++
    }

    if ('children' in node) {
      const children = (node as ChildrenMixin).children
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i])
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
  resetTraversalInstrument()

  function sendProgress(p: ScanProgress): void {
    onProgress?.(p)
    _traversalInstrument.progressUpdateCount++
  }

  const empty = (traversalMs: number): TraversalResult<TProperties> => ({
    items: [], traversalMs, extractionMs: 0, nodeCount: 0,
    progressEventCount: _traversalInstrument.progressUpdateCount,
  })

  sendProgress({ current: 0, total: 0, phase: 'collecting', label: 'Collecting layers…' })

  const tTraversalStart = Date.now()
  const matchedNodes: TNode[] = []
  const nodeToPage = new Map<string, PageInfo>()

  if (scope === 'selection') {
    const sel = figma.currentPage.selection
    if (sel.length === 0) { _traversalInstrument.traversalMs = Date.now() - tTraversalStart; return empty(_traversalInstrument.traversalMs) }
    for (const node of sel) {
      if (await collectNodesIterative(node, adapter.accepts, matchedNodes, isCancelled)) { _traversalInstrument.traversalMs = Date.now() - tTraversalStart; return empty(_traversalInstrument.traversalMs) }
    }
  } else if (scope === 'page') {
    if (await collectNodesIterative(figma.currentPage, adapter.accepts, matchedNodes, isCancelled)) { _traversalInstrument.traversalMs = Date.now() - tTraversalStart; return empty(_traversalInstrument.traversalMs) }
  } else {
    await figma.loadAllPagesAsync()
    for (const page of figma.root.children) {
      if (isCancelled()) { _traversalInstrument.traversalMs = Date.now() - tTraversalStart; return empty(_traversalInstrument.traversalMs) }
      sendProgress({ current: 0, total: 0, phase: 'collecting', label: `Traversing page "${page.name}"…` })
      const countBefore = matchedNodes.length
      if (await collectNodesIterative(page, adapter.accepts, matchedNodes, isCancelled)) { _traversalInstrument.traversalMs = Date.now() - tTraversalStart; return empty(_traversalInstrument.traversalMs) }
      const pageInfo: PageInfo = { pageId: page.id, pageName: intern(page.name) }
      for (let i = countBefore; i < matchedNodes.length; i++) nodeToPage.set(matchedNodes[i].id, pageInfo)
    }
  }

  _traversalInstrument.traversalMs = Date.now() - tTraversalStart
  const nodeCount = matchedNodes.length

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
        return { items: [], traversalMs: _traversalInstrument.traversalMs, extractionMs: Date.now() - tExtractionStart, nodeCount, progressEventCount: _traversalInstrument.progressUpdateCount }
      }
      const now = Date.now()
      if (now - lastProgressAt >= PROGRESS_THROTTLE_MS) {
        sendProgress({ current: i, total, phase: 'analyzing', label: `Analyzing ${i} of ${total}…` })
        lastProgressAt = now
      }
    }

    const node = matchedNodes[i]

    const _tExtract = Date.now()
    const props = adapter.extract(node)
    _traversalInstrument.extractionCallMs += Date.now() - _tExtract

    if (!props) continue
    _traversalInstrument.itemsExtracted++

    const _tPage = Date.now()
    const { pageId, pageName } =
      scope === 'file'
        ? (nodeToPage.get(node.id) ?? { pageId: currentPageId, pageName: currentPageName })
        : { pageId: currentPageId, pageName: currentPageName }
    _traversalInstrument.pageLookupMs += Date.now() - _tPage
    _traversalInstrument.pageLookupCount++

    // ── Parent access ───────────────────────────────────────────────────
    // Sprint 2: parentType is derived from nodeParent.type which was
    // already being accessed in the PAGE check — zero additional IPC cost.
    // hasAutoLayoutParent is only checked for layout-capable containers
    // (FRAME/COMPONENT/COMPONENT_SET) to minimise conditional IPC calls.
    const _tParent = Date.now()
    const nodeParent = node.parent   // IPC call
    let parentName: string | undefined
    let parentType: string | undefined
    let hasAutoLayoutParent = false

    if (nodeParent) {
      const pType = nodeParent.type  // IPC call (same as former PAGE check)
      if (pType !== 'PAGE') {
        parentType = pType as string
        parentName = intern(nodeParent.name)  // IPC call
        // Conditional auto-layout check — only for containers that support it.
        if (pType === 'FRAME' || pType === 'COMPONENT' || pType === 'COMPONENT_SET') {
          const lm = (nodeParent as BaseNode & { layoutMode?: string }).layoutMode
          hasAutoLayoutParent = lm !== undefined && lm !== 'NONE'
        }
      }
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
      parentType,
      hasAutoLayoutParent,
      properties: props,
    })
  }

  sendProgress({ current: total, total, phase: 'grouping', label: 'Grouping results…' })
  const extractionMs = Date.now() - tExtractionStart
  matchedNodes.length = 0

  return { items, traversalMs: _traversalInstrument.traversalMs, extractionMs, nodeCount, progressEventCount: _traversalInstrument.progressUpdateCount }
}
