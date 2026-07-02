// ─────────────────────────────────────────────────────────────
// Core Engine Types
// The engine knows nothing about any specific module (typography,
// colors, spacing, etc.). Every module conforms to these contracts.
// ─────────────────────────────────────────────────────────────

export type ScanScope = 'selection' | 'page' | 'file'

export interface ScanProgress {
  current: number
  total: number
  phase: 'collecting' | 'analyzing' | 'grouping'
  label?: string
}

/** A single design element found during a scan. TProperties is module-specific. */
export interface AuditItem<TProperties = Record<string, unknown>> {
  id: string
  nodeId: string
  nodeName: string
  pageId: string
  pageName: string
  parentName?: string
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
