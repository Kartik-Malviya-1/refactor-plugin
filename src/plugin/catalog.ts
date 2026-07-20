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
 *   Library styles → read from _styleCache (styles discovered during scan).
 *                    For file scope, the scan already traversed all pages.
 *                    For page/selection scope, only scanned-page styles are
 *                    included — no additional full-file traversal is performed
 *                    to avoid slow page switching and disruptive UX.
 */

import { getDiscoveredStyles } from '../modules/typography/scanner'
import type { AvailableTextStyle } from '../shared/migration'

const _catalog = new Map<string, AvailableTextStyle>()

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

  // ── Stage 2: Library styles from scan cache ──────────────────────────
  // Use styles already discovered during the scan — no additional
  // full-file traversal needed regardless of scope.
  let libraryCount = 0
  const discoveredStyles = getDiscoveredStyles()

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

  console.log(`[Refactor] catalog complete — ${localCount} local + ${libraryCount} library = ${_catalog.size} total (scope=${scanScope})`)
}
