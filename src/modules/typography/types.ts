import type { TypographySource } from '../../shared/typography-source'

export interface NormalizedLineHeight {
  unit: 'AUTO' | 'PIXELS' | 'PERCENT'
  value: number
}

export interface NormalizedLetterSpacing {
  unit: 'PIXELS' | 'PERCENT'
  value: number
}

export type NormalizedTextCase =
  | 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE' | 'SMALL_CAPS' | 'SMALL_CAPS_FORCED'

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
   * Sprint 2: Figma text style ID.
   * Empty string = no style. Non-empty = local or library style.
   */
  textStyleId?: string

  /**
   * v0.2.1: Full source classification resolved during scanning.
   * Included in the normalization key so same-visual / different-source
   * text produces separate Typography Signatures.
   */
  source: TypographySource
}
