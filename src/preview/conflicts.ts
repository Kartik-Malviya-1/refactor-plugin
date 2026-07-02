import type { CandidateFamily } from '../similarity/types'
import type { MigrationEntry, NewStyleTarget, AvailableTextStyle, AvailableTypographyVariable } from '../shared/migration'
import type { Conflict, ValidationIssue, ValidationResult } from './types'

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

export function detectConflicts(
  families: CandidateFamily[],
  entries: Record<string, MigrationEntry>
): Conflict[] {
  const conflicts: Conflict[] = []
  const newStyleNames = new Map<string, string[]>()  // name -> familyIds

  for (const family of families) {
    const entry = entries[family.id]
    if (!entry) continue

    // Missing target on a planned entry (defensive)
    if ((entry.status === 'planned' || entry.status === 'modified') && !entry.target) {
      conflicts.push({
        familyId: family.id,
        code: 'missing-target',
        severity: 'error',
        message: `Typography Family has “Planned” status but no target is set.`,
      })
    }

    // Empty new-style name
    if (entry.target?.type === 'new-style') {
      const t = entry.target as NewStyleTarget
      if (!t.name.trim()) {
        conflicts.push({
          familyId: family.id,
          code: 'empty-name',
          severity: 'error',
          message: 'Planned new style has no name. A name is required before migration.',
        })
      } else {
        const key = t.name.trim().toLowerCase()
        const existing = newStyleNames.get(key) ?? []
        existing.push(family.id)
        newStyleNames.set(key, existing)
      }
    }
  }

  // Duplicate new-style names across families
  for (const [name, familyIds] of newStyleNames) {
    if (familyIds.length > 1) {
      for (const fid of familyIds) {
        conflicts.push({
          familyId: fid,
          code: 'duplicate-name',
          severity: 'warning',
          message: `Planned style name “${name}” is used by ${familyIds.length} families. Duplicate names will conflict during execution.`,
        })
      }
    }
  }

  return conflicts
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function runValidation(
  families: CandidateFamily[],
  entries: Record<string, MigrationEntry>,
  textStyles: AvailableTextStyle[],
  variables: AvailableTypographyVariable[]
): ValidationResult {
  const issues: ValidationIssue[] = []
  const styleIds = new Set(textStyles.map(s => s.id))
  const varIds   = new Set(variables.map(v => v.id))
  const newNames = new Map<string, string[]>()

  for (const family of families) {
    const entry = entries[family.id]
    if (!entry) continue
    if (entry.status !== 'planned' && entry.status !== 'modified') continue

    if (!entry.target) {
      issues.push({ familyId: family.id, code: 'no-target', severity: 'error', message: 'No target defined for this planned family.' })
      continue
    }

    switch (entry.target.type) {
      case 'existing-style': {
        const t = entry.target as import('../shared/migration').ExistingStyleTarget
        if (!styleIds.has(t.styleId)) {
          issues.push({ familyId: family.id, code: 'style-not-found', severity: 'error', message: `Text style “${t.styleName}” could not be found. It may have been deleted.` })
        }
        break
      }
      case 'existing-variable': {
        const t = entry.target as import('../shared/migration').ExistingVariableTarget
        if (!varIds.has(t.variableId)) {
          issues.push({ familyId: family.id, code: 'variable-not-found', severity: 'error', message: `Variable “${t.variableName}” could not be found. It may have been deleted.` })
        }
        break
      }
      case 'new-style': {
        const t = entry.target as import('../shared/migration').NewStyleTarget
        const key = t.name.trim().toLowerCase()
        if (!key) {
          issues.push({ familyId: family.id, code: 'empty-name', severity: 'error', message: 'New style has no name.' })
        } else {
          const arr = newNames.get(key) ?? []
          arr.push(family.id)
          newNames.set(key, arr)
        }
        break
      }
    }
  }

  // Duplicate name errors
  for (const [name, fids] of newNames) {
    if (fids.length > 1) {
      for (const fid of fids) {
        issues.push({ familyId: fid, code: 'duplicate-name', severity: 'warning', message: `Style name “${name}” is planned for ${fids.length} families.` })
      }
    }
  }

  const errors   = issues.filter(i => i.severity === 'error')
  const warnings = issues.filter(i => i.severity === 'warning')

  return { valid: errors.length === 0, errors, warnings }
}
