import type { EnhancedTextStyle, AvailableTextStyle } from '../shared/migration'
import type { StyleRow } from './types'

export function buildStyleRows(
  enhancedStyles: EnhancedTextStyle[] | null,
  legacyStyles: AvailableTextStyle[],
): StyleRow[] {
  if (enhancedStyles && enhancedStyles.length > 0) {
    return [...enhancedStyles]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(s => {
        const boundVarNames = s.bindings.map(b => `${b.property}: ${b.variableName}`).join(', ')
        const collection = s.bindings.length > 0 ? s.bindings[0].collectionName : ''

        return {
          styleName: s.name,
          styleId: s.id,
          collection,
          source: s.isLocal ? 'Local' : (s.libraryName ?? 'Library'),
          fontFamily: s.fontFamily,
          fontWeight: s.fontStyle,
          fontSize: s.fontSize,
          lineHeight: s.lineHeight,
          letterSpacing: s.letterSpacing,
          usesVariables: s.usesVariables ? 'Yes' : 'No',
          variableCount: s.variableCount,
          boundVariables: boundVarNames || '—',
        }
      })
  }

  // Legacy fallback
  return [...legacyStyles]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(s => ({
      styleName: s.name,
      styleId: s.id,
      collection: '',
      source: s.isLocal ? 'Local' : (s.libraryName ?? 'Library'),
      fontFamily: s.fontFamily,
      fontWeight: s.fontStyle,
      fontSize: s.fontSize,
      lineHeight: '',
      letterSpacing: '',
      usesVariables: '—',
      variableCount: 0,
      boundVariables: '—',
    }))
}
