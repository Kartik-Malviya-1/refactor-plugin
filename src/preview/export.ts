import type { PreviewItem, MigrationStatistics, Conflict, ValidationResult } from './types'

// ---------------------------------------------------------------------------
// JSON export
// ---------------------------------------------------------------------------

export function exportToJSON(
  items: PreviewItem[],
  statistics: MigrationStatistics,
  conflicts: Conflict[],
  validation: ValidationResult
): void {
  const report = {
    generatedAt: new Date().toISOString(),
    tool: 'Refactor v0.1',
    summary: {
      totalFamilies:     statistics.totalFamilies,
      plannedFamilies:   statistics.plannedFamilies,
      skippedFamilies:   statistics.skippedFamilies,
      unplannedFamilies: statistics.unplannedFamilies,
      estimatedLayerChanges:       statistics.estimatedLayerChanges,
      estimatedDuplicateReduction: statistics.estimatedDuplicateReduction,
      validationPassed: validation.valid,
    },
    statistics,
    families: items.map(item => ({
      id:     item.familyId,
      dominant: {
        fontFamily:    item.before.fontFamily,
        fontStyle:     item.before.fontStyle,
        fontWeight:    item.before.fontWeight,
        fontSize:      item.before.fontSize,
      },
      target: {
        type:        item.after.type,
        displayName: item.after.displayName,
      },
      status:    item.entry.status,
      risk:      item.risk,
      riskFactors: item.riskFactors,
      impact: {
        layers:     item.affectedLayers,
        pages:      item.affectedPages,
        components: item.affectedComponents,
        instances:  item.affectedInstances,
      },
      changes: item.changes
        .filter(c => c.changed)
        .map(c => ({ property: c.property, before: c.before, after: c.after })),
    })),
    conflicts: conflicts.map(c => ({ familyId: c.familyId, code: c.code, severity: c.severity, message: c.message })),
    validation: {
      valid:    validation.valid,
      errors:   validation.errors.map(i => ({ familyId: i.familyId, code: i.code, message: i.message })),
      warnings: validation.warnings.map(i => ({ familyId: i.familyId, code: i.code, message: i.message })),
    },
  }

  downloadBlob(
    JSON.stringify(report, null, 2),
    'application/json',
    `refactor-migration-preview-${formatDate()}.json`
  )
}

// ---------------------------------------------------------------------------
// Markdown export
// ---------------------------------------------------------------------------

export function exportToMarkdown(
  items: PreviewItem[],
  statistics: MigrationStatistics,
  conflicts: Conflict[],
  validation: ValidationResult
): void {
  const lines: string[] = []

  lines.push(`# Refactor Migration Preview`)
  lines.push(`Generated: ${new Date().toLocaleString()}`)
  lines.push('')

  // Summary
  lines.push('## Summary')
  lines.push('')
  lines.push(`| Metric | Value |`)
  lines.push(`|--------|-------|`)
  lines.push(`| Typography Signatures | ${statistics.totalSignatures.toLocaleString()} |`)
  lines.push(`| Typography Families | ${statistics.totalFamilies.toLocaleString()} |`)
  lines.push(`| Planned | ${statistics.plannedFamilies} |`)
  lines.push(`| Skipped | ${statistics.skippedFamilies} |`)
  lines.push(`| Estimated Layer Changes | ${statistics.estimatedLayerChanges.toLocaleString()} |`)
  lines.push(`| Estimated Duplicate Reduction | ${statistics.estimatedDuplicateReduction.toLocaleString()} |`)
  lines.push(`| Validation | ${validation.valid ? '✅ Passed' : `❌ ${validation.errors.length} error(s)`} |`)
  lines.push('')

  // Conflicts
  if (conflicts.length > 0) {
    lines.push('## Conflicts')
    lines.push('')
    for (const c of conflicts) {
      lines.push(`- **${c.severity.toUpperCase()}** [${c.code}] ${c.message}`)
    }
    lines.push('')
  }

  // Families
  lines.push('## Planned Changes')
  lines.push('')
  for (const item of items) {
    lines.push(`### ${item.before.fontFamily} ${item.before.fontStyle} / ${item.before.fontSize}px`)
    lines.push('')
    lines.push(`**Target:** ${item.after.displayName}  `)
    lines.push(`**Risk:** ${item.risk}  `)
    lines.push(`**Impact:** ${item.affectedLayers.toLocaleString()} layers, ${item.affectedPages} pages, ${item.affectedComponents.toLocaleString()} components`)
    lines.push('')

    const changed = item.changes.filter(c => c.changed)
    if (changed.length > 0) {
      lines.push('**Changed Properties:**')
      for (const c of changed) {
        lines.push(`- ${c.property}: \`${c.before}\` → \`${c.after}\``)
      }
    } else {
      lines.push('*No property changes detected.*')
    }

    if (item.riskFactors.length > 0) {
      lines.push('')
      lines.push('**Risk Factors:**')
      for (const rf of item.riskFactors) lines.push(`- ${rf}`)
    }
    lines.push('')
  }

  downloadBlob(lines.join('\n'), 'text/markdown', `refactor-migration-preview-${formatDate()}.md`)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function downloadBlob(content: string, mimeType: string, filename: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
