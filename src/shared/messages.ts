import type { AuditResult, ScanProgress, ScanScope } from './types'
import type { NodeLocation, NavigationErrorCode } from './navigation'
import type { AvailableTextStyle, AvailableTypographyVariable } from './migration'

export type UIToPluginMessage =
  | { type: 'START_SCAN'; payload: { moduleId: string; scope: ScanScope } }
  | { type: 'CANCEL_SCAN' }
  | { type: 'SELECT_NODES'; payload: { locations: NodeLocation[] } }
  | { type: 'GET_SELECTION_INFO' }
  | { type: 'RESIZE'; payload: { width: number; height: number } }
  | { type: 'GET_PLANNING_DATA' }

export type PluginToUIMessage =
  | { type: 'SCAN_STARTED';   payload: { moduleId: string; scope: ScanScope } }
  | { type: 'SCAN_PROGRESS';  payload: ScanProgress }
  | { type: 'SCAN_COMPLETE';  payload: AuditResult }
  | { type: 'SCAN_ERROR';     payload: { error: string } }
  | { type: 'SCAN_CANCELLED' }
  | { type: 'SELECTION_INFO'; payload: { count: number; hasSelection: boolean; currentPageId: string } }
  | { type: 'NODES_SELECTED'; payload: { count: number; pageChanged: boolean; pageName: string; notFound: number } }
  | { type: 'NAVIGATION_ERROR'; payload: { error: string; code: NavigationErrorCode } }
  | { type: 'PLANNING_DATA'; payload: { textStyles: AvailableTextStyle[]; variables: AvailableTypographyVariable[] } }
  /**
   * v0.2.1: Sent when SELECT_NODES spans multiple pages.
   * The UI opens the Usage Explorer instead of attempting native selection.
   */
  | { type: 'SHOW_USAGE_EXPLORER' }
