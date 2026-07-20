import type { AuditGroup } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'
import type { EnhancedPlanningData } from '../shared/migration'
import type { RecipeResult } from './recipe-sheet'
import type { SummaryRow } from './types'

export function buildSummaryRows(
  groups: AuditGroup<TypographyProperties>[],
  enhanced: EnhancedPlanningData | null,
  recipeResult: RecipeResult | null,
): SummaryRow[] {
  const totalLayers = groups.reduce((s, g) => s + g.count, 0)
  const allPages = new Set<string>()
  let componentLayers = 0

  for (const g of groups) {
    for (const item of g.items) {
      allPages.add(item.pageId)
      if (item.parentType === 'COMPONENT' || item.parentType === 'COMPONENT_SET' || item.parentType === 'INSTANCE') {
        componentLayers++
      }
    }
  }

  const rows: SummaryRow[] = [
    // Scan Summary
    { metric: '── SCAN SUMMARY ──', value: '' },
    { metric: 'Typography Signatures', value: groups.length },
    { metric: 'Layers', value: totalLayers },
    { metric: 'Pages', value: allPages.size },
    { metric: 'Component Layers', value: componentLayers },
    { metric: '', value: '' },
  ]

  if (enhanced) {
    const d = enhanced.diagnostics

    rows.push(
      // Discovery Coverage
      { metric: '── DISCOVERY COVERAGE ──', value: '' },
      { metric: 'Text Styles', value: enhanced.textStyles.length },
      { metric: '  Local Styles', value: d.localStyleCount },
      { metric: '  Library Styles', value: d.libraryStyleCount },
      { metric: 'Variable Collections', value: d.collectionCount },
      { metric: '  Typography Collections', value: d.typographyCollectionCount },
      { metric: 'Variables Found', value: enhanced.variables.length },
      { metric: '  Local Variables', value: d.localVariableCount },
      { metric: '  Library Variables', value: d.libraryVariableCount },
      { metric: '', value: '' },
    )

    // Recipe Coverage
    if (recipeResult) {
      rows.push(
        { metric: '── RECIPE COVERAGE ──', value: '' },
        { metric: 'Recipes Generated', value: recipeResult.rows.length },
        { metric: '  Complete Recipes', value: recipeResult.completeCount },
        { metric: '  Partial Recipes', value: recipeResult.partialCount },
        { metric: '  Missing Recipes', value: recipeResult.missingCount },
        { metric: '', value: '' },
      )

      // Failed recipes detail
      if (recipeResult.failedRecipes.length > 0) {
        rows.push({ metric: '── MISSING RELATIONSHIPS ──', value: '' })
        for (const f of recipeResult.failedRecipes) {
          rows.push({ metric: `${f.styleName} → ${f.missingProperty}`, value: f.reason })
        }
      }
    }

    // Collections detail
    if (enhanced.collections.length > 0) {
      rows.push(
        { metric: '', value: '' },
        { metric: '── VARIABLE COLLECTIONS ──', value: '' },
      )
      for (const c of enhanced.collections) {
        rows.push({
          metric: `${c.name} (${c.isLocal ? 'Local' : 'Library'})`,
          value: `${c.variableCount} vars, ${c.modes.length} mode(s): ${c.modes.join(', ')}`,
        })
      }
    }
  } else {
    // Legacy fallback
    rows.push(
      { metric: 'Text Styles', value: 0 },
      { metric: 'Variables', value: 0 },
    )
  }

  return rows
}
