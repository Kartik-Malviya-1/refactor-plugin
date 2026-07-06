import type { AuditResult, ScanProgress, ScanScope } from './types'
import type { NodeLocation, NavigationErrorCode } from './navigation'
import type { AvailableTextStyle, AvailableTypographyVariable } from './migration'

/**
 * A single typography mutation to apply to one text node in the preview clone.
 * Serializable through postMessage — no Figma API types.
 */
export interface LayerMutation {
  layerId:           string
  targetType:        string   // 'existing-style' | 'new-style' | 'manual-values' | ...
  styleId?:          string
  fontFamily?:       string
  fontStyle?:        string
  fontSize?:         number
  lineHeightUnit?:   string
  lineHeightValue?:  number
  letterSpacingUnit?:  string
  letterSpacingValue?: number
}

export type UIToPluginMessage =
  | { type: 'START_SCAN';          payload: { moduleId: string; scope: ScanScope } }
  | { type: 'CANCEL_SCAN' }
  | { type: 'SELECT_NODES';        payload: { locations: NodeLocation[] } }
  | { type: 'GET_SELECTION_INFO' }
  | { type: 'RESIZE';              payload: { width: number; height: number } }
  | { type: 'GET_PLANNING_DATA' }
  | { type: 'REVIEW_NAVIGATE';     payload: { pageId: string; layerIds: string[] } }
  | { type: 'REVIEW_CLEAR_HIGHLIGHTS' }
  /**
   * Sprint D Preview Engine: request before+after PNG exports for one review item.
   * Plugin clones the frame, applies mutations to the clone, exports both, removes clone.
   */
  | { type: 'GENERATE_PREVIEW'; payload: { itemId: string; pageId: string; layerIds: string[]; mutations: LayerMutation[] } }

export type PluginToUIMessage =
  | { type: 'SCAN_STARTED';        payload: { moduleId: string; scope: ScanScope } }
  | { type: 'SCAN_PROGRESS';       payload: ScanProgress }
  | { type: 'SCAN_COMPLETE';       payload: AuditResult }
  | { type: 'SCAN_ERROR';          payload: { error: string } }
  | { type: 'SCAN_CANCELLED' }
  | { type: 'SELECTION_INFO';      payload: { count: number; hasSelection: boolean; currentPageId: string } }
  | { type: 'NODES_SELECTED';      payload: { count: number; pageChanged: boolean; pageName: string; notFound: number } }
  | { type: 'NAVIGATION_ERROR';    payload: { error: string; code: NavigationErrorCode } }
  | { type: 'PLANNING_DATA';       payload: { textStyles: AvailableTextStyle[]; variables: AvailableTypographyVariable[] } }
  | { type: 'SHOW_USAGE_EXPLORER' }
  | { type: 'REVIEW_NAVIGATED';    payload: { success: boolean } }
  /** Sprint D: preview generation results — base64 PNG strings. */
  | { type: 'PREVIEW_READY';       payload: { itemId: string; before: string; after: string } }
  | { type: 'PREVIEW_ERROR';       payload: { itemId: string; error: string } }
