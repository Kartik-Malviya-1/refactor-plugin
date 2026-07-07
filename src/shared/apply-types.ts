import type { ConsolidationTarget } from './migration'

export type MutationStatus = 'success' | 'skipped' | 'failed' | 'blocked'
export type ApplyPhase    = 'idle' | 'validating' | 'applying' | 'complete'

/** One text node to mutate. Built in UI from assignments + scan, sent via APPLY_PLAN. */
export interface ApplyEntry {
  nodeId:   string
  pageId:   string
  pageName: string
  nodeName: string
  sigKey:   string
  target:   ConsolidationTarget
}

export interface MutationResult {
  nodeId: string; nodeName: string; pageId: string; pageName: string
  sigKey: string; status: MutationStatus; error?: string; timestamp: number
}

export interface ApplyProgress {
  phase: ApplyPhase; total: number; applied: number
  skipped: number; failed: number; current?: string
}

export interface MigrationReport {
  startedAt: number; completedAt: number; durationMs: number
  totalNodes: number; successful: number; skipped: number
  failed: number; blocked: number; results: MutationResult[]
}
