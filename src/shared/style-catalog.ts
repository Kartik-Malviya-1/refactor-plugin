/**
 * Style Catalog utilities.
 *
 * Pure TypeScript — no Figma APIs. Used by both plugin and UI.
 */

/**
 * Parse a Figma style name into folder (first path segment) and display name.
 *
 * "Headings/H1"      → { folder: "Headings",     displayName: "H1" }
 * "Sub Headings/S1"  → { folder: "Sub Headings", displayName: "S1" }
 * "Caption"          → { folder: null,            displayName: "Caption" }
 * "Body/Large/Bold"  → { folder: "Body",          displayName: "Large/Bold" }
 *
 * Only the FIRST slash is used as separator. Additional segments become
 * part of displayName (no deeper nesting).
 */
export function parseStyleName(name: string): { folder: string | null; displayName: string } {
  const idx = name.indexOf('/')
  if (idx === -1) return { folder: null, displayName: name.trim() }
  return {
    folder:      name.slice(0, idx).trim(),
    displayName: name.slice(idx + 1).trim(),
  }
}

/** A folder group returned by groupByFolder. */
export interface StyleFolder<S> {
  /** Folder name (first path segment), or null for top-level styles. */
  folder:      string | null
  /** Display name shown in the UI. */
  displayName: string
  styles:      S[]
}

/**
 * Group any array of named styles into folder buckets.
 *
 * Each element must have a `name: string` property.
 * Folders are sorted alphabetically. Top-level styles appear last.
 */
export function groupByFolder<S extends { name: string }>(styles: S[]): StyleFolder<S>[] {
  const map = new Map<string | null, S[]>()

  for (const s of styles) {
    const { folder } = parseStyleName(s.name)
    const arr = map.get(folder) ?? []
    arr.push(s)
    map.set(folder, arr)
  }

  const result: StyleFolder<S>[] = []

  // Named folders first, alphabetically
  const folders = ([...map.keys()].filter(f => f !== null) as string[]).sort()
  for (const f of folders) {
    result.push({ folder: f, displayName: f, styles: map.get(f)! })
  }

  // Top-level (no folder) styles last
  const topLevel = map.get(null)
  if (topLevel?.length) {
    result.push({ folder: null, displayName: 'Other', styles: topLevel })
  }

  return result
}
