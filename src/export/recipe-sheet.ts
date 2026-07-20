import type { DiscoveredVariable, EnhancedTextStyle, FailedRecipe } from '../shared/migration'
import type { RecipeRow } from './types'

export interface RecipeResult {
  rows: RecipeRow[]
  completeCount: number
  partialCount: number
  missingCount: number
  failedRecipes: FailedRecipe[]
}

export function buildRecipeRows(
  enhancedStyles: EnhancedTextStyle[] | null,
  variables: DiscoveredVariable[] | null,
  legacyVariables: import('../shared/migration').AvailableTypographyVariable[],
): RecipeResult {
  const allVars = variables ?? legacyVariables.map(v => ({
    id: v.id, name: v.name, collectionId: '', collectionName: v.collectionName,
    resolvedType: v.resolvedType, isLocal: true, resolvedValue: null as string | number | boolean | null, mode: 'Default',
  }))

  if (allVars.length === 0) {
    return { rows: [], completeCount: 0, partialCount: 0, missingCount: 0, failedRecipes: [] }
  }

  const rows: RecipeRow[] = []
  const failedRecipes: FailedRecipe[] = []
  let completeCount = 0
  let partialCount = 0

  // Strategy 1: Generate recipes from style variable bindings
  if (enhancedStyles) {
    const stylesWithBindings = enhancedStyles.filter(s => s.usesVariables)
    for (const style of stylesWithBindings) {
      const recipe = buildRecipeFromBindings(style)
      rows.push(recipe)

      if (recipe.recipeStatus === 'Complete') completeCount++
      else if (recipe.recipeStatus === 'Partial') {
        partialCount++
        const missing = getMissingProperties(recipe)
        for (const prop of missing) {
          failedRecipes.push({ styleName: style.name, missingProperty: prop, reason: 'No Variable Binding Found' })
        }
      }
    }
  }

  // Strategy 2: Generate recipes from variable naming conventions
  const coveredTokens = new Set(rows.map(r => r.targetToken))
  const conventionRecipes = buildRecipesFromConventions(allVars, coveredTokens)
  for (const recipe of conventionRecipes) {
    rows.push(recipe)
    if (recipe.recipeStatus === 'Complete') completeCount++
    else if (recipe.recipeStatus === 'Partial') partialCount++
  }

  // Strategy 3: Report styles without any recipe
  if (enhancedStyles) {
    const allTokens = new Set(rows.map(r => r.targetToken.toLowerCase()))
    for (const style of enhancedStyles) {
      if (style.usesVariables) continue
      const styleLower = style.name.toLowerCase()
      if (!allTokens.has(styleLower)) {
        failedRecipes.push({ styleName: style.name, missingProperty: 'All Properties', reason: 'Style has no variable bindings' })
      }
    }
  }

  const missingCount = failedRecipes.length
  rows.sort((a, b) => a.targetToken.localeCompare(b.targetToken))

  return { rows, completeCount, partialCount, missingCount, failedRecipes }
}

function buildRecipeFromBindings(style: EnhancedTextStyle): RecipeRow {
  const recipe: RecipeRow = {
    targetToken: style.name,
    fontFamilyVariable: '',
    fontSizeVariable: '',
    fontWeightVariable: '',
    lineHeightVariable: '',
    letterSpacingVariable: '',
    recipeStatus: 'Missing',
  }

  for (const b of style.bindings) {
    switch (b.property) {
      case 'fontFamily': recipe.fontFamilyVariable = b.variableName; break
      case 'fontSize': recipe.fontSizeVariable = b.variableName; break
      case 'fontWeight': recipe.fontWeightVariable = b.variableName; break
      case 'lineHeight': recipe.lineHeightVariable = b.variableName; break
      case 'letterSpacing': recipe.letterSpacingVariable = b.variableName; break
    }
  }

  const filled = [recipe.fontFamilyVariable, recipe.fontSizeVariable, recipe.fontWeightVariable,
    recipe.lineHeightVariable, recipe.letterSpacingVariable].filter(v => v !== '').length

  if (filled >= 5) recipe.recipeStatus = 'Complete'
  else if (filled >= 1) recipe.recipeStatus = 'Partial'
  else recipe.recipeStatus = 'Missing'

  return recipe
}

function getMissingProperties(recipe: RecipeRow): string[] {
  const missing: string[] = []
  if (!recipe.fontFamilyVariable) missing.push('Font Family Variable')
  if (!recipe.fontSizeVariable) missing.push('Font Size Variable')
  if (!recipe.fontWeightVariable) missing.push('Font Weight Variable')
  if (!recipe.lineHeightVariable) missing.push('Line Height Variable')
  if (!recipe.letterSpacingVariable) missing.push('Letter Spacing Variable')
  return missing
}

function buildRecipesFromConventions(
  vars: { id: string; name: string; collectionName: string; resolvedType: string }[],
  exclude: Set<string>,
): RecipeRow[] {
  const suffixes = ['-size', '-weight', '-line', '-height', '-tracking', '-spacing', '-letter', '-family']
  const tokens = new Map<string, RecipeRow>()

  for (const v of vars) {
    const lower = v.name.toLowerCase()
    let base: string | null = null
    for (const suffix of suffixes) {
      const idx = lower.lastIndexOf(suffix)
      if (idx > 0) { base = v.name.slice(0, idx); break }
    }
    if (!base || exclude.has(base)) continue

    if (!tokens.has(base)) {
      tokens.set(base, {
        targetToken: base,
        fontFamilyVariable: '',
        fontSizeVariable: '',
        fontWeightVariable: '',
        lineHeightVariable: '',
        letterSpacingVariable: '',
        recipeStatus: 'Missing',
      })
    }

    const recipe = tokens.get(base)!
    if (lower.includes('family')) recipe.fontFamilyVariable = v.name
    else if (lower.includes('size')) recipe.fontSizeVariable = v.name
    else if (lower.includes('weight')) recipe.fontWeightVariable = v.name
    else if (lower.includes('line') || lower.includes('height')) recipe.lineHeightVariable = v.name
    else if (lower.includes('tracking') || lower.includes('spacing') || lower.includes('letter')) recipe.letterSpacingVariable = v.name
  }

  for (const recipe of tokens.values()) {
    const filled = [recipe.fontFamilyVariable, recipe.fontSizeVariable, recipe.fontWeightVariable,
      recipe.lineHeightVariable, recipe.letterSpacingVariable].filter(v => v !== '').length
    if (filled >= 5) recipe.recipeStatus = 'Complete'
    else if (filled >= 1) recipe.recipeStatus = 'Partial'
  }

  return [...tokens.values()]
}
