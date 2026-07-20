import type { AvailableTypographyVariable } from '../shared/migration'
import type { RecipeRow } from './types'

export function buildRecipeRows(
  variables: AvailableTypographyVariable[],
): RecipeRow[] {
  const byCollection = new Map<string, AvailableTypographyVariable[]>()
  for (const v of variables) {
    if (!byCollection.has(v.collectionName)) byCollection.set(v.collectionName, [])
    byCollection.get(v.collectionName)!.push(v)
  }

  const rows: RecipeRow[] = []

  for (const [, vars] of byCollection) {
    const stringVars = vars.filter(v => v.resolvedType === 'STRING')
    const floatVars = vars.filter(v => v.resolvedType === 'FLOAT')

    const tokens = new Set<string>()

    for (const v of vars) {
      const name = v.name
      const base = extractTokenBase(name)
      if (base) tokens.add(base)
    }

    if (tokens.size === 0) {
      for (const v of floatVars) {
        rows.push({
          targetToken: v.name,
          fontFamilyVariable: '',
          fontSizeVariable: inferMatch(v.name, 'size', floatVars) || v.name,
          fontWeightVariable: '',
          lineHeightVariable: '',
          letterSpacingVariable: '',
        })
      }
      continue
    }

    for (const token of tokens) {
      rows.push({
        targetToken: token,
        fontFamilyVariable: findVariable(token, 'family', stringVars) ?? '',
        fontSizeVariable: findVariable(token, 'size', floatVars) ?? '',
        fontWeightVariable: findVariable(token, 'weight', floatVars) ?? '',
        lineHeightVariable: findVariable(token, 'line', floatVars) ?? findVariable(token, 'height', floatVars) ?? '',
        letterSpacingVariable: findVariable(token, 'tracking', floatVars) ?? findVariable(token, 'spacing', floatVars) ?? findVariable(token, 'letter', floatVars) ?? '',
      })
    }
  }

  return rows.sort((a, b) => a.targetToken.localeCompare(b.targetToken))
}

function extractTokenBase(name: string): string | null {
  const suffixes = ['-size', '-weight', '-line', '-height', '-tracking', '-spacing', '-letter', '-family']
  const lower = name.toLowerCase()
  for (const suffix of suffixes) {
    const idx = lower.lastIndexOf(suffix)
    if (idx > 0) return name.slice(0, idx)
  }
  return null
}

function findVariable(
  tokenBase: string,
  suffix: string,
  vars: AvailableTypographyVariable[],
): string | undefined {
  const baseLower = tokenBase.toLowerCase()
  return vars.find(v => {
    const n = v.name.toLowerCase()
    return n.startsWith(baseLower) && n.includes(suffix)
  })?.name
}

function inferMatch(
  name: string,
  suffix: string,
  vars: AvailableTypographyVariable[],
): string | undefined {
  const lower = name.toLowerCase()
  if (lower.includes(suffix)) return name
  return vars.find(v => v.name.toLowerCase().includes(suffix))?.name
}
