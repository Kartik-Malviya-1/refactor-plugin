import type { AuditResult, ScanProgress, ScanScope } from './types'
import type { NodeLocation, NavigationErrorCode } from './navigation'

// ─── UI → Plugin ─────────────────────────────────────────────

export type UIToPluginMessage =
  | { type: 'START_SCAN'; payload: { moduleId: string; scope: ScanScope } }
  | { type: 'CANCEL_SCAN' }
  // SELECT_NODES carries full NodeLocation records so the plugin can
  // switch pages before resolving nodes. Sending only nodeIds caused
  // cross-page navigation to silently fail.
  | { type: 'SELECT_NODES'; payload: { locations: NodeLocation[] } }
  | { type: 'GET_SELECTION_INFO' }
  | { type: 'RESIZE'; payload: { width: number; height: number } }

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
      payload: {
        count: number
        // True when the plugin switched pages before selecting.
        // Lets the UI update its toast and inform the user.
        pageChanged: boolean
        pageName: string
        // Nodes that could not be found (deleted after scan)
        notFound: number
      }
    }
  | {
      type: 'NAVIGATION_ERROR'
      payload: {
        error: string
        code: NavigationErrorCode
      }
    }
