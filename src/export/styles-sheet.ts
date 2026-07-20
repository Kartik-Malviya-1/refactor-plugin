import type { AvailableTextStyle } from '../shared/migration'
import type { StyleRow } from './types'

export function buildStyleRows(
  textStyles: AvailableTextStyle[],
): StyleRow[] {
  return [...textStyles]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(s => ({
      styleName: s.name,
      source: s.isLocal ? 'Local' : (s.libraryName ?? 'Library'),
      fontFamily: s.fontFamily,
      fontWeight: s.fontStyle,
      fontSize: s.fontSize,
      lineHeight: '',
      letterSpacing: '',
      styleId: s.id,
    }))
}
