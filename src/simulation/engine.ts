import type { CandidateFamily } from '../similarity/types'
import type { MigrationEntry, AvailableTextStyle, AvailableTypographyVariable } from '../shared/migration'
import type { PreviewItem, ValidationResult, Conflict } from '../preview/types'
import type {
  SimulationResult, ExecutionStep, Dependency, RollbackEntry,
  DryRunStep, ReadinessFactor, ReadinessLabel, StageSummary, StepStatus,
} from './types'
import { STAGE_ORDER } from './types'
import type {
  ExistingStyleTarget, ExistingVariableTarget, NewStyleTarget,
  ConsolidationTarget,
} from '../shared/migration'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTargetLabel(target: ConsolidationTarget): string {
  switch (target.type) {
    case 'existing-style':    return (target as ExistingStyleTarget).styleName
    case 'existing-variable': return (target as ExistingVariableTarget).variableName
    case 'new-style':         return (target as NewStyleTarget).name || '(unnamed new style)'
    case 'manual-values':     return 'Manual Values'
    case 'skip':              return 'Skip'
  }
}

function stageSummary(
  steps: ExecutionStep[],
  stage: typeof STAGE_ORDER[number]
): StageSummary {
  const s = steps.filter(st => st.stage === stage)
  return {
    stage,
    total:     s.length,
    succeeded: s.filter(st => st.status === 'succeeded').length,
    warnings:  s.filter(st => st.status === 'warning').length,
    failed:    s.filter(st => st.status === 'failed').length,
    blocked:   s.filter(st => st.status === 'blocked').length,
    skipped:   s.filter(st => st.status === 'skipped').length,
  }
}

// ---------------------------------------------------------------------------
// Main simulation function
// ---------------------------------------------------------------------------

/**
 * Runs a complete migration simulation.
 *
 * Pure function — no Figma API calls, no document modifications.
 * Uses data already collected by the scan, planning, and preview pipelines.
 *
 * Outputs:
 *  - Deterministic execution order (8-phase pipeline per family)
 *  - Dependency graph (what each family requires to execute)
 *  - Rollback entries (current state captured for future reversal)
 *  - Dry run (simulated execution with status per family)
 *  - Readiness score (0–100, 6 weighted factors)
 */
export function runSimulation(
  families: CandidateFamily[],
  entries: Record<string, MigrationEntry>,
  textStyles: AvailableTextStyle[],
  variables: AvailableTypographyVariable[],
  _previewItems: PreviewItem[],
  validation: ValidationResult,
  conflicts: Conflict[]
): SimulationResult {
  const styleMap = new Map(textStyles.map(s => [s.id, s]))
  const varMap   = new Map(variables.map(v => [v.id, v]))

  const planned = families.filter(f => {
    const e = entries[f.id]
    return e && (e.status === 'planned' || e.status === 'modified') && e.target
  })

  const conflictSet   = new Set(conflicts.map(c => c.familyId))
  const errorSet      = new Set(validation.errors.map(e => e.familyId))
  const warningSet    = new Set(validation.warnings.map(e => e.familyId))

  // ── 1. Execution Order ───────────────────────────────────────
  const executionOrder: ExecutionStep[] = []

  for (const family of planned) {
    const entry      = entries[family.id]
    const target     = entry.target!
    const hasError   = errorSet.has(family.id)
    const hasWarn    = warningSet.has(family.id) || conflictSet.has(family.id)
    const isConflict = conflictSet.has(family.id)
    const familyLabel = `${family.dominant.fontFamily} ${family.dominant.fontStyle} / ${family.dominant.fontSize}px`

    // Phase 1: Validate
    executionOrder.push({
      stage: 'validate', familyId: family.id,
      description: `Validate planning decision for "${familyLabel}"`,
      status: hasError ? 'failed' : isConflict ? 'warning' : 'succeeded',
      errors:   hasError   ? validation.errors.filter(e => e.familyId === family.id).map(e => e.message) : undefined,
      warnings: isConflict ? conflicts.filter(c => c.familyId === family.id).map(c => c.message)         : undefined,
    })

    // Phase 2: Resolve Target
    let resolveStatus: StepStatus = 'succeeded'
    let resolveDetail = ''
    if (target.type === 'existing-style') {
      if (!styleMap.has((target as ExistingStyleTarget).styleId)) {
        resolveStatus = 'blocked'
        resolveDetail = `Style “${(target as ExistingStyleTarget).styleName}” not found in available styles`
      }
    } else if (target.type === 'existing-variable') {
      if (!varMap.has((target as ExistingVariableTarget).variableId)) {
        resolveStatus = 'blocked'
        resolveDetail = `Variable “${(target as ExistingVariableTarget).variableName}” not found`
      }
    } else if (target.type === 'new-style' && !(target as NewStyleTarget).name.trim()) {
      resolveStatus = 'failed'
      resolveDetail = 'New style has no name — a name is required'
    }

    executionOrder.push({
      stage: 'resolve-targets', familyId: family.id,
      description: `Resolve target: ${getTargetLabel(target)}`,
      status: resolveStatus,
      details: resolveDetail || undefined,
    })

    const isBlocked = resolveStatus === 'blocked' || hasError

    // Phase 3-4: Verify (only relevant phases emitted)
    if (target.type === 'existing-style') {
      executionOrder.push({
        stage: 'verify-styles', familyId: family.id,
        description: `Verify text style “${(target as ExistingStyleTarget).styleName}”`,
        status: isBlocked ? 'blocked' : 'succeeded',
      })
    }
    if (target.type === 'existing-variable') {
      executionOrder.push({
        stage: 'verify-variables', familyId: family.id,
        description: `Verify variable “${(target as ExistingVariableTarget).variableName}”`,
        status: isBlocked ? 'blocked' : 'succeeded',
      })
    }

    // Phase 5-7: Prepare
    const componentCount = family.usageBreakdown['COMPONENT']    ?? 0
    const instanceCount  = family.usageBreakdown['INSTANCE']     ?? 0

    executionOrder.push({
      stage: 'prepare-layers', familyId: family.id,
      description: `Prepare ${family.totalLayers.toLocaleString()} layer updates`,
      status: isBlocked ? 'blocked' : hasWarn ? 'warning' : 'succeeded',
      details: `${family.totalLayers.toLocaleString()} text layers`,
    })

    if (componentCount > 0) {
      executionOrder.push({
        stage: 'prepare-components', familyId: family.id,
        description: `Prepare ${componentCount.toLocaleString()} component updates`,
        status: isBlocked ? 'blocked' : 'warning',  // component changes always warrant attention
        warnings: ['Component updates may propagate to library consumers'],
        details: `${componentCount.toLocaleString()} component layers`,
      })
    }

    if (instanceCount > 0) {
      executionOrder.push({
        stage: 'prepare-instances', familyId: family.id,
        description: `Prepare ${instanceCount.toLocaleString()} instance updates`,
        status: isBlocked ? 'blocked' : 'succeeded',
        details: `${instanceCount.toLocaleString()} instance layers`,
      })
    }

    // Phase 8: Ready
    executionOrder.push({
      stage: 'ready', familyId: family.id,
      description: 'Ready for execution',
      status: isBlocked ? 'blocked' : hasError ? 'failed' : hasWarn ? 'warning' : 'succeeded',
    })
  }

  // Stage summaries (aggregate per stage across all families)
  const stageSummaries: StageSummary[] = STAGE_ORDER
    .map(stage => stageSummary(executionOrder, stage))
    .filter(s => s.total > 0)

  // ── 2. Dependency Analysis ────────────────────────────────────
  const dependencies: Dependency[] = []
  let criticalDependenciesMissing = 0
  let dependenciesResolved = 0

  for (const family of planned) {
    const target = entries[family.id].target!

    if (target.type === 'existing-style') {
      const t = target as ExistingStyleTarget
      const available = styleMap.has(t.styleId)
      const isLib = !!t.libraryName
      dependencies.push({
        familyId: family.id,
        type: isLib ? 'library-style' : 'existing-style',
        name: t.styleName,
        available,
        critical: true,
        description: isLib
          ? `Library style from “${t.libraryName}” — must be enabled in this file`
          : `Local text style “${t.styleName}”`,
      })
      if (!available) criticalDependenciesMissing++; else dependenciesResolved++
    }

    if (target.type === 'existing-variable') {
      const t = target as ExistingVariableTarget
      const available = varMap.has(t.variableId)
      dependencies.push({
        familyId: family.id,
        type: 'variable',
        name: t.variableName,
        available,
        critical: true,
        description: `Variable “${t.variableName}” in collection “${t.collectionName}”`,
      })
      if (!available) criticalDependenciesMissing++; else dependenciesResolved++
    }

    // Font: informational (cannot verify without Figma API in simulation)
    const dom = family.dominant
    dependencies.push({
      familyId: family.id,
      type: 'font',
      name: `${dom.fontFamily} ${dom.fontStyle}`,
      available: true,
      critical: false,
      description: `Font “${dom.fontFamily} ${dom.fontStyle}” must be available on all editing devices`,
    })
    dependenciesResolved++

    // Component nesting: informational risk flag
    const compCount = (family.usageBreakdown['COMPONENT'] ?? 0) + (family.usageBreakdown['INSTANCE'] ?? 0)
    if (compCount > 0) {
      dependencies.push({
        familyId: family.id,
        type: 'component-nesting',
        name: `${compCount.toLocaleString()} component/instance layers`,
        available: true,
        critical: false,
        description: `${compCount.toLocaleString()} layers inside components — verify component editability before execution`,
      })
    }
  }

  // ── 3. Rollback Entries ───────────────────────────────────────
  const rollbackEntries: RollbackEntry[] = planned.map(family => {
    const entry  = entries[family.id]
    const target = entry.target!
    return {
      familyId:           family.id,
      familyLabel:        `${family.dominant.fontFamily} ${family.dominant.fontStyle} / ${family.dominant.fontSize}px`,
      currentProperties:  family.dominant,
      currentStyleId:     null,  // textStyleId would be needed from extended scan data
      targetType:         target.type,
      targetLabel:        getTargetLabel(target),
      nodeCount:          family.totalLayers,
    }
  })
  const rollbackReady = rollbackEntries.length === planned.length

  // ── 4. Dry Run ────────────────────────────────────────────────
  const dryRunSteps: DryRunStep[] = planned.map(family => {
    const hasError   = errorSet.has(family.id)
    const isConflict = conflictSet.has(family.id)
    const isBlocked  = criticalDependenciesMissing > 0 &&
      dependencies.some(d => d.familyId === family.id && !d.available && d.critical)
    const hasOutliers = family.outlierCount > 0

    let status: StepStatus = 'succeeded'
    let message = 'Simulation succeeded — ready for execution'

    if (hasError) {
      status = 'failed'
      message = validation.errors.find(e => e.familyId === family.id)?.message ?? 'Validation failed'
    } else if (isBlocked) {
      status = 'blocked'
      message = dependencies.find(d => d.familyId === family.id && !d.available && d.critical)?.description ?? 'Dependency not resolved'
    } else if (isConflict) {
      status = 'warning'
      message = conflicts.find(c => c.familyId === family.id)?.message ?? 'Conflict detected'
    } else if (hasOutliers) {
      status = 'warning'
      message = `${family.outlierCount} outlier${family.outlierCount !== 1 ? 's' : ''} may not benefit from this change`
    }

    return {
      familyId:     family.id,
      familyLabel:  `${family.dominant.fontFamily} ${family.dominant.fontStyle} / ${family.dominant.fontSize}px`,
      status,
      message,
      warningCount: (isConflict ? 1 : 0) + (hasOutliers ? 1 : 0),
      errorCount:   hasError ? 1 : 0,
      layerCount:   family.totalLayers,
    }
  })

  const dryRunSucceeded = dryRunSteps.filter(s => s.status === 'succeeded').length
  const dryRunWarnings  = dryRunSteps.filter(s => s.status === 'warning').length
  const dryRunFailed    = dryRunSteps.filter(s => s.status === 'failed').length
  const dryRunSkipped   = dryRunSteps.filter(s => s.status === 'skipped').length
  const dryRunBlocked   = dryRunSteps.filter(s => s.status === 'blocked').length
  const blockedFamilyIds = dryRunSteps.filter(s => s.status === 'blocked' || s.status === 'failed').map(s => s.familyId)

  // ── 5. Readiness Score ────────────────────────────────────────
  const allEntries    = Object.values(entries)
  const plannedCount  = allEntries.filter(e => e.status === 'planned' || e.status === 'modified').length
  const totalFamilies = families.length
  const planningPct   = totalFamilies > 0 ? Math.round(plannedCount / totalFamilies * 100) : 0

  const readinessFactors: ReadinessFactor[] = [
    {
      name: 'Validation', weight: 25,
      score:  validation.valid ? 100 : Math.max(0, 100 - validation.errors.length * 25),
      passed: validation.valid,
      detail: validation.valid ? 'All planned targets are valid' : `${validation.errors.length} validation error(s) must be resolved`,
    },
    {
      name: 'No Conflicts', weight: 20,
      score:  conflicts.length === 0 ? 100 : Math.max(0, 100 - conflicts.length * 20),
      passed: conflicts.length === 0,
      detail: conflicts.length === 0 ? 'No conflicts detected' : `${conflicts.length} conflict(s) require attention`,
    },
    {
      name: 'Targets Defined', weight: 20,
      score:  planned.length > 0 ? Math.round((dryRunSucceeded + dryRunWarnings) / planned.length * 100) : 0,
      passed: dryRunFailed === 0 && dryRunBlocked === 0,
      detail: (dryRunFailed + dryRunBlocked) === 0
        ? 'All targets are defined and valid'
        : `${dryRunFailed + dryRunBlocked} famil${(dryRunFailed + dryRunBlocked) !== 1 ? 'ies' : 'y'} blocked or failed`,
    },
    {
      name: 'Dependencies', weight: 15,
      score:  criticalDependenciesMissing === 0 ? 100 : Math.max(0, 100 - criticalDependenciesMissing * 30),
      passed: criticalDependenciesMissing === 0,
      detail: criticalDependenciesMissing === 0
        ? 'All critical dependencies resolved'
        : `${criticalDependenciesMissing} critical dependenc${criticalDependenciesMissing !== 1 ? 'ies' : 'y'} missing`,
    },
    {
      name: 'Planning Complete', weight: 10,
      score:  planningPct,
      passed: planningPct >= 80,
      detail: `${planningPct}% of families planned`,
    },
    {
      name: 'Rollback Ready', weight: 10,
      score:  rollbackReady ? 100 : 0,
      passed: rollbackReady,
      detail: rollbackReady
        ? `${rollbackEntries.length} rollback entr${rollbackEntries.length !== 1 ? 'ies' : 'y'} prepared`
        : 'Rollback data incomplete',
    },
  ]

  const readinessScore = Math.round(
    readinessFactors.reduce((sum, f) => sum + (f.score * f.weight / 100), 0)
  )
  const readinessLabel: ReadinessLabel =
    readinessScore >= 81 ? 'Execution Ready'
    : readinessScore >= 61 ? 'Ready'
    : readinessScore >= 41 ? 'Needs Review'
    : 'Not Ready'

  // ── 6. Summary ───────────────────────────────────────────────
  const totalLayers = planned.reduce((s, f) => s + f.totalLayers, 0)
  // Conservative estimate: 10ms per layer processed
  const estimatedExecutionTimeMs = totalLayers * 10

  return {
    executionOrder,
    stageSummaries,
    dependencies,
    criticalDependenciesMissing,
    dependenciesResolved,
    rollbackEntries,
    rollbackReady,
    dryRunSteps,
    dryRunSucceeded,
    dryRunWarnings,
    dryRunFailed,
    dryRunSkipped,
    dryRunBlocked,
    readinessScore,
    readinessLabel,
    readinessFactors,
    estimatedExecutionTimeMs,
    totalFamiliesPlanned: planned.length,
    totalLayersAffected: totalLayers,
    blockedFamilyIds,
    simulationWarnings: [
      ...conflicts.map(c => c.message),
      ...(dryRunWarnings > 0 ? [`${dryRunWarnings} famil${dryRunWarnings !== 1 ? 'ies' : 'y'} have warnings`] : []),
    ],
    simulationErrors: validation.errors.map(e => e.message),
  }
}
