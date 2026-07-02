import type { AuditResult, ScanProgress, ScanScope } from './types'

// ─── UI → Plugin ─────────────────────────────────────────────

export type UIToPluginMessage =
  | { type: 'START_SCAN'; payload: { moduleId: string; scope: ScanScope } }
  | { type: 'CANCEL_SCAN' }
  | { type: 'SELECT_NODES'; payload: { nodeIds: string[] } }
  | { type: 'GET_SELECTION_INFO' }
  | { type: 'RESIZE'; payload: { width: number; height: number } }

// ─── Plugin → UI ─────────────────────────────────────────────

export type PluginToUIMessage =
  | { type: 'SCAN_STARTED'; payload: { moduleId: string; scope: ScanScope } }
  | { type: 'SCAN_PROGRESS'; payload: ScanProgress }
  | { type: 'SCAN_COMPLETE'; payload: AuditResult }
  | { type: 'SCAN_ERROR'; payload: { error: string } }
  | { type: 'SCAN_CANCELLED' }
  | { type: 'SELECTION_INFO'; payload: { count: number; hasSelection: boolean } }
  | { type: 'NODES_SELECTED'; payload: { count: number } }
