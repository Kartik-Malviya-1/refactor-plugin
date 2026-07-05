/**
 * Canonical Style Catalog — single source of truth for the Assignment picker,
 * LibraryStylesPage, Review Changes, Apply, and future AI features.
 *
 * The catalog is built ONCE after each scan and cached in _catalog. It is
 * always more complete than the scan-scoped _styleCache because:
 *
 *   Local styles  → figma.getLocalTextStylesAsync() — always returns ALL
 *                   local styles regardless of scan scope.
 *
 *   Library styles → if scope=file: read from _styleCache (full traversal
 *                    already done during scan).
 *                    if scope=page/selection: additionally traverse ALL pages
 *                    to collect textStyleIds from the rest of the document,
 *                    then resolve via getStyleByIdAsync.
 *
 * The page-switching in the non-file path happens during the scan wait
 * (before SCAN_COMPLETE is sent), not during GET_PLANNING_DATA, so the user
 * never sees a disruptive page change when opening the Assignment panel.
 */

import { getDiscoveredStyles } from '../modules/typography/scanner'
import type { AvailableTextStyle } from '../shared/migration'

const _catalog = new Map<string, AvailableTextStyle>()

function collectStyleIds(nodes: ReadonlyArray<SceneNode>, ids: Set<string>): void {
  for (const node of nodes) {
    if (node.type === 'TEXT') {
      const id = (node as TextNode).textStyleId
      if (typeof id === 'string' && id.length > 0) ids.add(id)
    }
    if ('children' in node) collectStyleIds((node as ChildrenMixin).children, ids)
  }
}

export function clearCatalogCache(): void { _catalog.clear() }

/** Returns all catalog entries sorted: local first, then library, both alphabetical. */
export function getCatalogStyles(): AvailableTextStyle[] {
  return [..._catalog.values()].sort((a, b) => {
    if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

/**
 * Build (or rebuild) the canonical style catalog.
 *
 * Must be called with `await` in START_SCAN after scanEngine.run() returns
 * and before SCAN_COMPLETE is sent, so the catalog is warm when the UI
 * requests GET_PLANNING_DATA immediately after.
 */
export async function buildCatalogAsync(scanScope: string): Promise<void> {
  _catalog.clear()

  // ── Stage 1: All local text styles ───────────────────────────────────
  // figma.getLocalTextStylesAsync() is scope-independent — always returns
  // every local text style defined in the file.
  let localCount = 0
  try {
    const local = await figma.getLocalTextStylesAsync()
    for (const s of local) {
      const fn = s.fontName as FontName
      if (!fn || typeof fn.family !== 'string') continue
      _catalog.set(s.id, {
        id: s.id, name: s.name,
        fontFamily: fn.family, fontStyle: fn.style,
        fontSize: typeof s.fontSize === 'number' ? s.fontSize : 0,
        isLocal: true,
      })
      localCount++
    }
  } catch (err) {
    console.error('[Refactor] catalog stage 1 failed:', err)
  }
  const localIds = new Set(_catalog.keys())

  // ── Stage 2: Library styles ───────────────────────────────────────
  let libraryCount = 0
  const discoveredStyles = getDiscoveredStyles()  // scan-scoped cache

  if (scanScope === 'file') {
    // Full-file scan already ran — _styleCache has all textStyleIds.
    // No additional traversal needed, avoiding a second round of page switching.
    for (const [id, cached] of discoveredStyles) {
      if (!cached || !cached.remote || localIds.has(id)) continue
      if (!cached.fontFamily || !cached.fontStyle || cached.fontSize == null) continue
      const segs = cached.name.split('/')
      _catalog.set(id, {
        id, name: cached.name,
        fontFamily: cached.fontFamily, fontStyle: cached.fontStyle, fontSize: cached.fontSize,
        isLocal: false,
        libraryName: segs.length > 1 ? segs[0].trim() : undefined,
      })
      libraryCount++
    }
    console.log(`[Refactor] catalog: ${libraryCount} library styles (file-scope cache)`)
  } else {
    // page/selection scope — _styleCache only covers the scanned subset.
    // Traverse ALL pages to discover styles from the rest of the document.
    const allStyleIds = new Set<string>()
    const startPage = figma.currentPage
    try {
      for (const child of figma.root.children) {
        if (child.type === 'PAGE') {
          await figma.setCurrentPageAsync(child as PageNode)
          collectStyleIds((child as PageNode).children, allStyleIds)
        }
      }
    } catch (err) {
      console.error('[Refactor] catalog stage 2 traversal failed:', err)
    } finally {
      try { await figma.setCurrentPageAsync(startPage) } catch {}
    }
    console.log(`[Refactor] catalog: ${allStyleIds.size} unique textStyleIds from full-file traversal`)

    for (const id of allStyleIds) {
      if (localIds.has(id) || _catalog.has(id)) continue

      if (discoveredStyles.has(id)) {
        // Already resolved during scan — use cache (no extra API call)
        const cached = discoveredStyles.get(id)
        if (!cached || !cached.fontFamily || !cached.fontStyle || cached.fontSize == null) continue
        const segs = cached.name.split('/')
        _catalog.set(id, {
          id, name: cached.name,
          fontFamily: cached.fontFamily, fontStyle: cached.fontStyle, fontSize: cached.fontSize,
          isLocal: false,
          libraryName: segs.length > 1 ? segs[0].trim() : undefined,
        })
        libraryCount++
      } else {
        // New ID not in scan cache — resolve async
        try {
          const style = await figma.getStyleByIdAsync(id)
          if (!style || style.type !== 'TEXT') continue
          const ts = style as unknown as TextStyle
          const fn = ts.fontName as FontName
          if (!fn || typeof fn.family !== 'string' || typeof ts.fontSize !== 'number') continue
          const segs = style.name.split('/')
          _catalog.set(id, {
            id, name: style.name,
            fontFamily: fn.family, fontStyle: fn.style, fontSize: ts.fontSize,
            isLocal: false,
            libraryName: segs.length > 1 ? segs[0].trim() : undefined,
          })
          libraryCount++
        } catch { /* unavailable style — skip silently */ }
      }
    }
    console.log(`[Refactor] catalog: ${libraryCount} library styles (full-file traversal)`)
  }

  console.log(`[Refactor] catalog complete — ${localCount} local + ${libraryCount} library = ${_catalog.size} total`)
}
