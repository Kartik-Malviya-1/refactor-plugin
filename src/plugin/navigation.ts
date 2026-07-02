import type { NodeLocation, NavigationErrorCode } from '../shared/navigation'

// ---------------------------------------------------------------------------
// Shared Navigation Service
//
// Resolves NodeLocation records to live Figma nodes, switching pages when
// required. This is a platform service — every module uses it.
//
// No module-specific navigation logic belongs here.
// There is no TypographyNavigator, no ColorNavigator, no VariableNavigator.
// This single function handles navigation for the entire Refactor platform.
// ---------------------------------------------------------------------------

export interface NavigationResult {
  selected: number
  pageChanged: boolean
  pageName: string
  notFound: number
}

export interface NavigationFailure {
  code: NavigationErrorCode
  message: string
}

export type NavigationOutcome =
  | { ok: true;  result: NavigationResult }
  | { ok: false; error: NavigationFailure }

/**
 * Navigate to the nodes identified by the provided NodeLocation records.
 *
 * Algorithm:
 *  1. Validate input
 *  2. Group locations by page (all locations with the same pageId are resolved together)
 *  3. If the first group's page differs from figma.currentPage, switch pages
 *  4. Resolve nodes by ID on the now-current page
 *  5. Select the resolved nodes and center the viewport
 *
 * Multi-page selections (nodes on different pages in the same call):
 *  Only the first page's nodes are selected in this iteration.
 *  The locations from other pages are ignored with a count in notFound.
 *  Future: a UI choice when the selection spans pages.
 *
 * Failure modes:
 *  PAGE_NOT_FOUND — the page was deleted after the audit
 *  NODE_NOT_FOUND — all target nodes were deleted after the audit
 *  PARTIAL         — some nodes missing; partial selection is made
 *
 * O(1) for page switching (array search over a handful of pages).
 * O(N) within the page for findOne (unavoidable given the Figma API).
 */
export async function navigateToLocations(
  locations: NodeLocation[]
): Promise<NavigationOutcome> {
  if (locations.length === 0) {
    return {
      ok: false,
      error: {
        code: 'NO_LOCATIONS',
        message: 'No layers were provided for navigation.',
      },
    }
  }

  // Group by page. We navigate to the first page's nodes.
  const targetPageId    = locations[0].pageId
  const targetPageName  = locations[0].pageName
  const targetLocations = locations.filter(loc => loc.pageId === targetPageId)

  let pageChanged = false

  // ── Step 1: Switch page if needed ─────────────────────────────────
  if (figma.currentPage.id !== targetPageId) {
    const targetPage = figma.root.children.find(
      (p) => p.id === targetPageId
    ) as PageNode | undefined

    if (!targetPage) {
      return {
        ok: false,
        error: {
          code: 'PAGE_NOT_FOUND',
          message:
            `Page “${targetPageName}” no longer exists. ` +
            'The audit may be outdated — please re-run the scan.',
        },
      }
    }

    await figma.setCurrentPageAsync(targetPage)
    pageChanged = true
  }

  const currentPageName = figma.currentPage.name

  // ── Step 2: Resolve nodes by ID on the current page ─────────────────
  const resolved: SceneNode[] = []
  for (const loc of targetLocations) {
    const node = figma.currentPage.findOne((n: BaseNode) => n.id === loc.nodeId)
    if (node) resolved.push(node as SceneNode)
  }

  if (resolved.length === 0) {
    const plural = targetLocations.length !== 1
    return {
      ok: false,
      error: {
        code: 'NODE_NOT_FOUND',
        message:
          `${plural ? 'All layers' : 'This layer'} no longer ${plural ? 'exist' : 'exists'} ` +
          `on “${currentPageName}”. ${plural ? 'They' : 'It'} may have been deleted — ` +
          'please re-run the scan.',
      },
    }
  }

  // ── Step 3: Select and center ─────────────────────────────────────
  figma.currentPage.selection = resolved
  figma.viewport.scrollAndZoomIntoView(resolved)

  return {
    ok: true,
    result: {
      selected:    resolved.length,
      pageChanged,
      pageName:    currentPageName,
      notFound:    targetLocations.length - resolved.length,
    },
  }
}
