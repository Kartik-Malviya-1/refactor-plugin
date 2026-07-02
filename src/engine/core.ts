import type { AuditGroup, AuditItem, ScanProgress, ScanScope } from '../shared/types'
import type { ScannerAdapter, EngineTimings } from './types'
import { traverseAndExtract } from './traversal'
import { groupItems } from './grouper'

// ---------------------------------------------------------------------------
// Core Scan Engine
//
// Owns: traversal, extraction, progress reporting, cancellation, grouping
// orchestration, and profiling.
//
// Knows nothing about: Typography, Colors, or any other domain module.
// Domain knowledge lives entirely in the ScannerAdapter provided by the
// caller. Adding a new module requires zero changes here.
// ---------------------------------------------------------------------------

export interface EngineRunResult<TProperties> {
  items: AuditItem<TProperties>[]
  groups: AuditGroup<TProperties>[]
}

export class CoreScanEngine {
  private _timings: EngineTimings = {
    traversalMs: 0,
    extractionMs: 0,
    groupingMs: 0,
    sortingMs: 0,
    nodeCount: 0,
    progressEventCount: 0,
  }

  /** Timing data from the most recent run(). Read by the profiler in main.ts. */
  get timings(): Readonly<EngineTimings> {
    return this._timings
  }

  async run<TNode extends BaseNode, TProperties>(
    adapter: ScannerAdapter<TNode, TProperties>,
    scope: ScanScope,
    isCancelled: () => boolean,
    onProgress?: (p: ScanProgress) => void
  ): Promise<EngineRunResult<TProperties>> {
    // ── Traversal + Extraction ─────────────────────────────────────────────
    const traversalResult = await traverseAndExtract(
      adapter,
      scope,
      isCancelled,
      onProgress
    )

    if (isCancelled()) {
      this._timings = {
        traversalMs: traversalResult.traversalMs,
        extractionMs: traversalResult.extractionMs,
        groupingMs: 0,
        sortingMs: 0,
        nodeCount: traversalResult.nodeCount,
        progressEventCount: traversalResult.progressEventCount,
      }
      return { items: [], groups: [] }
    }

    // ── Grouping ────────────────────────────────────────────────────────
    const groupResult = await groupItems(
      adapter.moduleId,
      traversalResult.items,
      adapter.normalize,
      adapter.describe,
      isCancelled
    )

    this._timings = {
      traversalMs: traversalResult.traversalMs,
      extractionMs: traversalResult.extractionMs,
      groupingMs: groupResult.groupingMs,
      sortingMs: groupResult.sortingMs,
      nodeCount: traversalResult.nodeCount,
      progressEventCount: traversalResult.progressEventCount,
    }

    return {
      items: traversalResult.items,
      groups: groupResult.groups,
    }
  }
}

/**
 * Singleton engine instance used by the plugin backend.
 * Future: instantiate per-scan if concurrent scanning is ever needed.
 */
export const scanEngine = new CoreScanEngine()
