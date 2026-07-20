import type { EnhancedTextStyle, StylePropertyBinding } from '../shared/migration'

const TYPOGRAPHY_BINDING_FIELDS = [
  'fontFamily', 'fontSize', 'fontStyle', 'fontWeight',
  'lineHeight', 'letterSpacing', 'paragraphSpacing', 'paragraphIndent',
]

export async function discoverEnhancedStyles(): Promise<EnhancedTextStyle[]> {
  const results: EnhancedTextStyle[] = []

  // Local styles
  try {
    const localStyles = await figma.getLocalTextStylesAsync()
    for (const style of localStyles) {
      const enhanced = await inspectTextStyle(style, true)
      if (enhanced) results.push(enhanced)
    }
  } catch (err) {
    console.error('[Refactor] Local style discovery failed:', err)
  }

  // Library styles discovered from scan cache
  // (Library styles are already captured in the catalog; we enhance them here)

  console.log(`[Refactor] Style discovery: ${results.length} styles (${results.filter(s => s.usesVariables).length} with variable bindings)`)
  return results
}

async function inspectTextStyle(
  style: TextStyle,
  isLocal: boolean,
): Promise<EnhancedTextStyle | null> {
  try {
    const fn = style.fontName as FontName
    if (!fn || typeof fn.family !== 'string') return null

    const bindings: StylePropertyBinding[] = []
    const bv = (style as unknown as { boundVariables?: Record<string, { id?: string }> }).boundVariables

    if (bv) {
      for (const field of TYPOGRAPHY_BINDING_FIELDS) {
        const binding = bv[field]
        if (!binding?.id) continue

        let varName = binding.id
        let collName = ''
        try {
          const v = await figma.variables.getVariableByIdAsync(binding.id)
          if (v) {
            varName = v.name
            try {
              const coll = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId)
              if (coll) collName = coll.name
            } catch { /* collection not accessible */ }
          }
        } catch { /* variable not accessible */ }

        bindings.push({
          property: field,
          variableId: binding.id,
          variableName: varName,
          collectionName: collName,
        })
      }
    }

    // Format line height
    let lineHeight = 'Auto'
    const lh = style.lineHeight as LineHeight
    if (lh && lh.unit !== 'AUTO') {
      lineHeight = lh.unit === 'PERCENT' ? `${lh.value}%` : `${lh.value}px`
    }

    // Format letter spacing
    let letterSpacing = '0'
    const ls = style.letterSpacing as LetterSpacing
    if (ls && ls.value !== 0) {
      letterSpacing = ls.unit === 'PERCENT' ? `${ls.value}%` : `${ls.value}px`
    }

    // Determine library name from style name segments
    const segments = style.name.split('/')
    const libraryName = !isLocal && segments.length > 1 ? segments[0].trim() : undefined

    return {
      id: style.id,
      name: style.name,
      isLocal,
      libraryName,
      fontFamily: fn.family,
      fontStyle: fn.style,
      fontSize: typeof style.fontSize === 'number' ? style.fontSize : 0,
      lineHeight,
      letterSpacing,
      usesVariables: bindings.length > 0,
      variableCount: bindings.length,
      bindings,
    }
  } catch {
    return null
  }
}
