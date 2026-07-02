/**
 * NodeLocation — the canonical model for locating any node inside a Figma document.
 *
 * This is a shared platform contract. Every Refactor module (Typography, Colors,
 * Spacing, Radius, Effects, Variables, Components) uses NodeLocation for navigation.
 * No module implements its own navigation model.
 *
 * Design goals:
 * • Module-agnostic: the same type works for every audit module
 * • Breadcrumb-ready: fields support future page → section → frame → layer display
 * • Lightweight: stores identifiers and human names only — no live Figma references
 * • O(1) page switching: pageId enables direct page resolution without document search
 * • Self-describing: path gives a human-readable breadcrumb from scan-time data
 */
export interface NodeLocation {
  // Core identity — always present
  nodeId: string
  nodeName: string

  // Page — always present; every node lives on exactly one page.
  // pageId is the key that enables cross-page navigation.
  pageId: string
  pageName: string

  // Nearest named frame ancestor — populated during scan from node.parent.
  // Enables the inspector to show layer context ("inside Hero Section").
  frameId?: string
  frameName?: string

  // Section-level ancestor (Figma Sections, not frames)
  sectionId?: string
  sectionName?: string

  // Component hierarchy — populated for components and their instances
  componentId?: string
  componentName?: string
  componentSetId?: string
  componentSetName?: string
  instanceId?: string
  instanceName?: string

  /**
   * Human-readable breadcrumb path built from scan-time data.
   * Format: "Page Name → Frame Name → Node Name"
   *
   * Not computed at navigation time — built during scanning at zero
   * extra IPC cost since the ancestor data is already available.
   * Intended for future inspector breadcrumb and tooltip display.
   */
  path?: string
}

/**
 * Builds a NodeLocation from the fields already present in any AuditItem.
 * Accepts a structural subset so it works with any module's AuditItem<T>
 * without importing the generic type directly.
 *
 * No additional IPC calls required — reuses data already collected during scanning.
 */
export function locationFromItem(item: {
  nodeId: string
  nodeName: string
  pageId: string
  pageName: string
  parentName?: string
}): NodeLocation {
  const path = item.parentName
    ? `${item.pageName} → ${item.parentName} → ${item.nodeName}`
    : `${item.pageName} → ${item.nodeName}`

  return {
    nodeId:    item.nodeId,
    nodeName:  item.nodeName,
    pageId:    item.pageId,
    pageName:  item.pageName,
    frameName: item.parentName,
    path,
  }
}

/**
 * Navigation error codes.
 * The UI maps these to user-readable explanations with recovery guidance.
 */
export type NavigationErrorCode =
  | 'PAGE_NOT_FOUND'    // page was deleted after the scan
  | 'NODE_NOT_FOUND'    // node was deleted after the scan
  | 'PARTIAL_SELECTION' // some nodes found, some no longer exist
  | 'NO_LOCATIONS'      // empty locations array sent
