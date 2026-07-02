import type { AuditResult, ScanProgress, ScanScope } from './types'
import type { NodeLocation, NavigationErrorCode } from './navigation'
import type { AvailableTextStyle, AvailableTypographyVariable } from './migration'

// ─── UI → Plugin ─────────────────────────────────────────────

export type UIToPluginMessage =
  | { type: 'START_SCAN'; payload: { moduleId: string; scope: ScanScope } }
  | { type: 'CANCEL_SCAN' }
  | { type: 'SELECT_NODES'; payload: { locations: NodeLocation[] } }
  | { type: 'GET_SELECTION_INFO' }
  | { type: 'RESIZE'; payload: { width: number; height: number } }
  // Sprint 4: fetch styles and variables available for planning targets
  | { type: 'GET_PLANNING_DATA' }

// ─── Plugin → UI ─────────────────────────────────────────────

export type PluginToUIMessage =
  | { type: 'SCAN_STARTED';   payload: { moduleId: string; scope: ScanScope } }
  | { type: 'SCAN_PROGRESS';  payload: ScanProgress }
  | { type: 'SCAN_COMPLETE';  payload: AuditResult }
  | { type: 'SCAN_ERROR';     payload: { error: string } }
  | { type: 'SCAN_CANCELLED' }
  | { type: 'SELECTION_INFO'; payload: { count: number; hasSelection: boolean } }
  | {
      type: 'NODES_SELECTED'
      payload: { count: number; pageChanged: boolean; pageName: string; notFound: number }
    }
  | { type: 'NAVIGATION_ERROR'; payload: { error: string; code: NavigationErrorCode } }
  // Sprint 4: planning data response
  | {
      type: 'PLANNING_DATA'
      payload: {
        textStyles: AvailableTextStyle[]
        variables: AvailableTypographyVariable[]
      }
    }
