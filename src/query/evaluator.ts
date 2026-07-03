import type { AuditGroup } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'
import type { QueryCondition, QueryExpression, QueryOperator, QueryValue } from './types'

// ---------------------------------------------------------------------------
// Comparison helpers
// ---------------------------------------------------------------------------

function matchNumber(actual: number, op: QueryOperator, value: QueryValue): boolean {
  const v = Number(value)
  switch (op) {
    case 'eq':  return actual === v
    case 'ne':  return actual !== v
    case 'gt':  return actual > v
    case 'gte': return actual >= v
    case 'lt':  return actual < v
    case 'lte': return actual <= v
    default:    return false
  }
}

function matchString(actual: string, op: QueryOperator, value: QueryValue): boolean {
  const a = actual.toLowerCase()
  const v = String(value).toLowerCase()
  switch (op) {
    case 'eq':       return a === v
    case 'ne':       return a !== v
    case 'contains': return a.includes(v)
    default:         return a === v
  }
}

// ---------------------------------------------------------------------------
// Per-condition evaluation
// ---------------------------------------------------------------------------

function matchCondition(
  group: AuditGroup<TypographyProperties>,
  cond: QueryCondition
): boolean {
  if (!cond.enabled) return true
  const p = group.descriptor
  const v = cond.value

  switch (cond.field) {
    case 'fontFamily':         return matchString(p.fontFamily, cond.operator, v)
    case 'fontSize':           return matchNumber(p.fontSize, cond.operator, v)
    case 'fontWeight':         return matchNumber(p.fontWeight, cond.operator, v)
    case 'textCase':           return matchString(p.textCase, cond.operator, v)
    case 'textDecoration':     return matchString(p.textDecoration, cond.operator, v)
    case 'source':             return matchString(group.source ?? 'Raw Values', cond.operator, v)
    case 'library':            return matchString(p.source?.libraryName ?? '', cond.operator, v)
    case 'variableCollection': return matchString(p.source?.variableCollection ?? '', cond.operator, v)
    case 'layerCount':         return matchNumber(group.count, cond.operator, v)
    case 'page': {
      // Match if any item in the group is on a page whose name contains the query
      return group.items.some(item => matchString(item.pageName, cond.operator, v))
    }
    default: return true
  }
}

// ---------------------------------------------------------------------------
// Main evaluator — pure function
// ---------------------------------------------------------------------------

/**
 * Evaluates a QueryExpression against a list of Typography Signature groups.
 *
 * All enabled conditions are ANDed together.
 * An empty or all-disabled expression matches everything.
 *
 * Pure function — no Figma API calls, no side effects.
 * Runs entirely on cached scan results.
 */
export function evaluateQuery(
  groups: AuditGroup<TypographyProperties>[],
  query: QueryExpression
): AuditGroup<TypographyProperties>[] {
  const active = query.conditions.filter(c => c.enabled)
  if (active.length === 0) return groups
  return groups.filter(group => active.every(cond => matchCondition(group, cond)))
}
