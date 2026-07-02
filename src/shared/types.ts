// ─────────────────────────────────────────────────────────────
// Core Engine Types
// ─────────────────────────────────────────────────────────────

export type ScanScope = 'selection' | 'page' | 'file'

export interface ScanProgress {
  current: number
  total: number
  phase: 'collecting' | 'analyzing' | 'grouping'
  label?: string
}

/**
 * Sprint 2: Source classification for Typography Signatures.
 * Shared type used in both the plugin backend (classification) and
 * the UI (display). Never infer — Unknown is the correct fallback.
 */
export type SourceType =
  | 'Raw Values'
  | 'Local Text Style'
  | 'Library Text Style'
  | 'Variable'
  | 'Unknown'

/** A single design element found during a scan. TProperties is module-specific. */
export interface AuditItem<TProperties = Record<string, unknown>> {
  id: string
  nodeId: string
  nodeName: string
  pageId: string
  pageName: string
  parentName?: string

  // Sprint 2: structural enrichment — populated by traversal engine.
  // parentType: immediate parent node type (FRAME, COMPONENT, INSTANCE, etc.)
  // hasAutoLayoutParent: true if the parent is a layout-mode container.
  parentType?: string
  hasAutoLayoutParent?: boolean

  properties: TProperties
}

/** A group of items sharing identical normalized properties. */
export interface AuditGroup<TProperties = Record<string, unknown>> {
  id: string
  key: string
  label: string
  count: number
  items: AuditItem<TProperties>[]
  descriptor: TProperties
  // Sprint 2: source classification — set by plugin backend after grouping.
  source?: SourceType
}

/** The complete result of a scan. Fully JSON-serializable for postMessage. */
export interface AuditResult<TProperties = Record<string, unknown>> {
  moduleId: string
  scope: ScanScope
  scopeLabel: string
  totalItems: number
  groups: AuditGroup<TProperties>[]
  scannedAt: number
  durationMs: number
}

/** Summary stats computed from an AuditResult. */
export interface AuditSummary {
  totalItems: number
  totalGroups: number
  topGroup: { label: string; count: number } | null
}

/** Every audit module must implement this interface. */
export interface AuditModule<TProperties = Record<string, unknown>> {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly icon: string

  scan(
    scope: ScanScope,
    onProgress?: (p: ScanProgress) => void
  ): Promise<AuditItem<TProperties>[]>

  normalize(item: AuditItem<TProperties>): string
  describe(descriptor: TProperties): string
  group(items: AuditItem<TProperties>[]): AuditGroup<TProperties>[]
}

/** Static metadata used to render module nav entries. */
export interface ModuleRegistration {
  id: string
  name: string
  description: string
  icon: string
  available: boolean
  comingSoon: boolean
}
