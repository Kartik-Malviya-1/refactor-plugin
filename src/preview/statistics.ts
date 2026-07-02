import type { CandidateFamily } from '../similarity/types'
import type { MigrationEntry } from '../shared/migration'
import type { PreviewItem, MigrationStatistics } from './types'

export function generateStatistics(
  families: CandidateFamily[],
  entries: Record<string, MigrationEntry>,
  items: PreviewItem[],
  conflictCount: number,
  validationErrors: number,
  validationWarnings: number
): MigrationStatistics {
  const allEntries = Object.values(entries)
  const planned = allEntries.filter(e => e.status === 'planned' || e.status === 'modified')
  const skipped = allEntries.filter(e => e.status === 'skipped')

  const totalLayers = items.reduce((s, i) => s + i.affectedLayers, 0)
  const totalPages  = new Set(items.flatMap(i => [...i.family.pageIds])).size
  const totalComps  = items.reduce((s, i) => s + i.affectedComponents, 0)

  // Estimated duplicate reduction:
  // Count unique planned targets vs total signatures in planned families.
  const uniqueTargetKeys = new Set<string>()
  for (const e of planned) {
    if (!e.target) continue
    switch (e.target.type) {
      case 'existing-style':    uniqueTargetKeys.add(`style:${e.target.styleId}`); break
      case 'existing-variable': uniqueTargetKeys.add(`var:${e.target.variableId}`); break
      case 'new-style':         uniqueTargetKeys.add(`new:${e.target.name.trim().toLowerCase()}`); break
      case 'manual-values':     uniqueTargetKeys.add(`manual:${JSON.stringify({ f: e.target.fontFamily, s: e.target.fontStyle, sz: e.target.fontSize })}`); break
    }
  }

  const signaturesInPlanned = planned.reduce((s, e) => s + e.affectedSignatures, 0)
  const estimatedReduction  = Math.max(0, signaturesInPlanned - uniqueTargetKeys.size)

  return {
    totalSignatures:  families.reduce((s, f) => s + f.signatureCount, 0),
    totalFamilies:    families.length,
    plannedFamilies:  planned.length,
    skippedFamilies:  skipped.length,
    unplannedFamilies: families.length - planned.length - skipped.length,

    existingStylesUsed: planned.filter(e => e.target?.type === 'existing-style').length,
    variablesUsed:      planned.filter(e => e.target?.type === 'existing-variable').length,
    newStylesPlanned:   planned.filter(e => e.target?.type === 'new-style').length,
    manualTargets:      planned.filter(e => e.target?.type === 'manual-values').length,

    estimatedLayerChanges:     totalLayers,
    estimatedAffectedPages:    totalPages,
    estimatedAffectedComponents: totalComps,
    estimatedDuplicateReduction: estimatedReduction,

    conflictCount,
    validationErrors,
    validationWarnings,
  }
}
