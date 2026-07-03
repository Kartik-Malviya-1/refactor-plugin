/**
 * TypographySource — canonical source model for Typography.
 *
 * Every Typography Signature has exactly one source, determined during
 * scanning from the Figma Plugin API. No inference is performed.
 */
export interface TypographySource {
  /** Where this typography definition originates. */
  type: 'Raw' | 'LocalStyle' | 'LibraryStyle' | 'Variable'

  // ─ Style fields (LocalStyle / LibraryStyle) ─────────────────────
  /** Figma style ID (e.g. "S:abc123"). */
  styleId?: string
  /** Human-readable style name (e.g. "Heading / H1"). */
  styleName?: string
  /**
   * Library name. Derived from the first segment of the style name
   * when separated by "/" (best-effort for library styles).
   * Undefined for local styles.
   */
  libraryName?: string
  /** Published style key (stable across file moves). */
  libraryKey?: string

  // ─ Variable fields (Variable) ────────────────────────────
  variableId?: string
  variableName?: string
  variableCollection?: string
  variableMode?: string
}

/** Stable string key for grouping/comparison (type + optional styleId). */
export function sourceKey(source: TypographySource): string {
  return `${source.type}:${source.styleId ?? ''}`
}
