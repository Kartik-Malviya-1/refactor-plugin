// ---------------------------------------------------------------------------
// Core Scan Engine — abstraction boundary types
//
// The engine never imports from modules/. Modules never appear in engine
// code. Only ScannerAdapters cross the boundary.
// ---------------------------------------------------------------------------

/**
 * Contract between the Core Scan Engine and a domain module.
 *
 * The engine calls accepts() on every node it visits during traversal.
 * For nodes that pass, it calls extract() to get domain properties.
 * normalize() and describe() are used during the grouping phase.
 *
 * Future modules (Colors, Spacing, Radius, …) provide their own adapter.
 * The engine requires zero modification to support them.
 */
export interface ScannerAdapter<TNode extends BaseNode, TProperties> {
  readonly moduleId: string

  /** Returns true if the engine should collect this node. */
  accepts(node: BaseNode): node is TNode

  /**
   * Extracts domain-specific properties from a matched node.
   * Return null to skip nodes that match the type but have no
   * meaningful properties (e.g. empty text layers).
   */
  extract(node: TNode): TProperties | null

  /**
   * Produces a canonical string key for grouping.
   * Items with identical keys land in the same AuditGroup.
   */
  normalize(properties: TProperties): string

  /** Human-readable label for a group given its canonical properties. */
  describe(properties: TProperties): string
}

/** Timing data produced by CoreScanEngine.run(). */
export interface EngineTimings {
  traversalMs: number
  extractionMs: number
  groupingMs: number
  sortingMs: number
  nodeCount: number
  progressEventCount: number
}
