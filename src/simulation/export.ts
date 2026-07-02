import type { SimulationResult } from './types'
import { STAGE_LABEL } from './types'

// ---------------------------------------------------------------------------
// JSON export
// ---------------------------------------------------------------------------

export function exportSimulationToJSON(sim: SimulationResult): void {
  const report = {
    generatedAt: new Date().toISOString(),
    tool: 'Refactor v0.1',
    readiness: {
      score: sim.readinessScore,
      label: sim.readinessLabel,
      factors: sim.readinessFactors.map(f => ({
        name: f.name, weight: f.weight, score: f.score, passed: f.passed, detail: f.detail,
      })),
    },
    summary: {
      familiesPlanned:            sim.totalFamiliesPlanned,
      layersAffected:             sim.totalLayersAffected,
      estimatedExecutionTimeMs:   sim.estimatedExecutionTimeMs,
      rollbackReady:              sim.rollbackReady,
      criticalDependenciesMissing: sim.criticalDependenciesMissing,
    },
    dryRun: {
      succeeded: sim.dryRunSucceeded,
      warnings:  sim.dryRunWarnings,
      failed:    sim.dryRunFailed,
      blocked:   sim.dryRunBlocked,
      steps: sim.dryRunSteps.map(s => ({
        familyId:    s.familyId,
        familyLabel: s.familyLabel,
        status:      s.status,
        message:     s.message,
        layers:      s.layerCount,
      })),
    },
    executionPipeline: sim.stageSummaries.map(s => ({
      stage: s.stage,
      label: STAGE_LABEL[s.stage],
      total: s.total, succeeded: s.succeeded, warnings: s.warnings, failed: s.failed, blocked: s.blocked,
    })),
    dependencies: sim.dependencies.map(d => ({
      familyId: d.familyId, type: d.type, name: d.name,
      available: d.available, critical: d.critical, description: d.description,
    })),
    rollback: sim.rollbackEntries.map(r => ({
      familyId:    r.familyId,
      familyLabel: r.familyLabel,
      targetType:  r.targetType,
      targetLabel: r.targetLabel,
      layers:      r.nodeCount,
      currentProperties: {
        fontFamily: r.currentProperties.fontFamily,
        fontStyle:  r.currentProperties.fontStyle,
        fontSize:   r.currentProperties.fontSize,
      },
    })),
    errors:   sim.simulationErrors,
    warnings: sim.simulationWarnings,
  }

  downloadBlob(
    JSON.stringify(report, null, 2),
    'application/json',
    `refactor-simulation-${formatDate()}.json`
  )
}

// ---------------------------------------------------------------------------
// Markdown export
// ---------------------------------------------------------------------------

export function exportSimulationToMarkdown(sim: SimulationResult): void {
  const lines: string[] = []

  lines.push(`# Refactor Migration Simulation`)
  lines.push(`Generated: ${new Date().toLocaleString()}`)
  lines.push('')

  // Readiness
  lines.push('## Migration Readiness')
  lines.push('')
  lines.push(`**Score:** ${sim.readinessScore}/100 — ${sim.readinessLabel}`)
  lines.push('')
  lines.push('| Factor | Weight | Score | Status |')
  lines.push('|--------|--------|-------|--------|')
  for (const f of sim.readinessFactors) {
    lines.push(`| ${f.name} | ${f.weight}% | ${f.score}% | ${f.passed ? '✅' : '⚠️'} ${f.detail} |`)
  }
  lines.push('')

  // Summary
  lines.push('## Simulation Summary')
  lines.push('')
  lines.push(`| Metric | Value |`)
  lines.push(`|--------|-------|`)
  lines.push(`| Families Planned | ${sim.totalFamiliesPlanned} |`)
  lines.push(`| Layers Affected | ${sim.totalLayersAffected.toLocaleString()} |`)
  lines.push(`| Rollback Ready | ${sim.rollbackReady ? '✅ Yes' : '❌ No'} |`)
  lines.push(`| Critical Dependencies Missing | ${sim.criticalDependenciesMissing} |`)
  lines.push(`| Estimated Execution Time | ~${(sim.estimatedExecutionTimeMs / 1000).toFixed(1)}s (estimate) |`)
  lines.push('')

  // Dry Run
  lines.push('## Dry Run Results')
  lines.push('')
  lines.push(`- Succeeded: ${sim.dryRunSucceeded}`)
  lines.push(`- Warnings: ${sim.dryRunWarnings}`)
  lines.push(`- Failed: ${sim.dryRunFailed}`)
  lines.push(`- Blocked: ${sim.dryRunBlocked}`)
  lines.push('')
  lines.push('| Family | Status | Layers | Notes |')
  lines.push('|--------|--------|--------|-------|')
  for (const s of sim.dryRunSteps) {
    const statusIcon = s.status === 'succeeded' ? '✅' : s.status === 'warning' ? '⚠️' : '❌'
    lines.push(`| ${s.familyLabel} | ${statusIcon} ${s.status} | ${s.layerCount.toLocaleString()} | ${s.message} |`)
  }
  lines.push('')

  // Pipeline
  lines.push('## Execution Pipeline')
  lines.push('')
  for (const stage of sim.stageSummaries) {
    lines.push(`### ${STAGE_LABEL[stage.stage]}`)
    lines.push(`${stage.succeeded} succeeded · ${stage.warnings} warnings · ${stage.failed} failed · ${stage.blocked} blocked`)
    lines.push('')
  }

  // Issues
  if (sim.simulationErrors.length > 0) {
    lines.push('## Errors')
    lines.push('')
    for (const e of sim.simulationErrors) lines.push(`- ❌ ${e}`)
    lines.push('')
  }
  if (sim.simulationWarnings.length > 0) {
    lines.push('## Warnings')
    lines.push('')
    for (const w of sim.simulationWarnings) lines.push(`- ⚠️ ${w}`)
    lines.push('')
  }

  downloadBlob(lines.join('\n'), 'text/markdown', `refactor-simulation-${formatDate()}.md`)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(): string { return new Date().toISOString().slice(0, 10) }

function downloadBlob(content: string, mimeType: string, filename: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}
