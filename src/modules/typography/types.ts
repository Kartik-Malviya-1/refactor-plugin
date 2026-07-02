// Typography-specific properties. Fully JSON-serializable.

export interface NormalizedLineHeight {
  unit: 'AUTO' | 'PIXELS' | 'PERCENT'
  value: number
}

export interface NormalizedLetterSpacing {
  unit: 'PIXELS' | 'PERCENT'
  value: number
}

export type NormalizedTextCase =
  | 'ORIGINAL'
  | 'UPPER'
  | 'LOWER'
  | 'TITLE'
  | 'SMALL_CAPS'
  | 'SMALL_CAPS_FORCED'

export type NormalizedTextDecoration = 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH'

export interface TypographyProperties {
  fontFamily: string
  fontStyle: string
  fontWeight: number
  fontSize: number
  lineHeight: NormalizedLineHeight
  letterSpacing: NormalizedLetterSpacing
  textCase: NormalizedTextCase
  textDecoration: NormalizedTextDecoration

  /**
   * Sprint 2: Figma text style ID attached to this node.
   * Empty string = no style (Raw Values).
   * Non-empty = has a style; plugin determines local vs library.
   *
   * Intentionally excluded from normalizeTypographyProps() so that
   * two layers with the same visual properties but different styles
   * remain in the same Typography Signature group.
   */
  textStyleId?: string
}
