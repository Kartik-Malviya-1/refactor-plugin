import type { TypographyProperties } from '../modules/typography/types'

// ---------------------------------------------------------------------------
// Pipeline stages (in execution order)
// ---------------------------------------------------------------------------

export type ExecutionStage =
  | 'validate'            // run all validation checks
  | 'resolve-targets'     // look up style/variable references
  | 'verify-styles'       // confirm text styles still exist
  | 'verify-variables'    // confirm variables still exist
  | 'prepare-layers'      // plan text-layer level updates
  | 'prepare-components'  // plan component-level updates
  | 'prepare-instances'   // plan instance-level updates
  | 'ready'               // family is cleared for execution

export const STAGE_ORDER: ExecutionStage[] = [
  'validate', 'resolve-targets', 'verify-styles', 'verify-variables',
  'prepare-layers', 'prepare-components', 'prepare-instances', 'ready',
]

export const STAGE_LABEL: Record<ExecutionStage, string> = {
  validate:            'Validate',
  'resolve-targets':   'Resolve Targets',
  'verify-styles':     'Verify Styles',
  'verify-variables':  'Verify Variables',
  'prepare-layers':    'Prepare Layers',
  'prepare-components': 'Prepare Components',
  'prepare-instances': 'Prepare Instances',
  ready:               'Ready',
}

// ---------------------------------------------------------------------------
// Step status
// ---------------------------------------------------------------------------

export type StepStatus = 'succeeded' | 'warning' | 'failed' | 'skipped' | 'blocked'

// ---------------------------------------------------------------------------
// Dependency types
// ---------------------------------------------------------------------------

export type DependencyType =
  | 'existing-style'    // local text style
  | 'library-style'     // style from a shared library
  | 'variable'          // typography variable
  | 'font'              // font family availability
  | 'component-nesting' // node inside a component

// ---------------------------------------------------------------------------
// Core simulation types
// ---------------------------------------------------------------------------

export interface ExecutionStep {
  stage: ExecutionStage
  familyId: string
  description: string
  status: StepStatus
  details?: string
  warnings?: string[]
  errors?: string[]
}

export interface Dependency {
  familyId: string
  type: DependencyType
  name: string
  /** Whether this dependency can be resolved from current planning data. */
  available: boolean
  /** If unavailable, blocks execution entirely. */
  critical: boolean
  description: string
}

/**
 * Rollback data captured before execution.
 * Stores the current state so migration can be reversed.
 * Generated without touching the document.
 */
export interface RollbackEntry {
  familyId: string
  familyLabel: string
  currentProperties: TypographyProperties
  /** Current text style ID, if the family was already style-bound. */
  currentStyleId: string | null
  targetType: string
  targetLabel: string
  /** Number of layers that would need to be reverted. */
  nodeCount: number
}

export interface DryRunStep {
  familyId: string
  familyLabel: string
  status: StepStatus
  message: string
  warningCount: number
  errorCount: number
  layerCount: number
}

export interface ReadinessFactor {
  name: string
  /** 0–100 score for this factor specifically. */
  score: number
  /** Relative weight in the overall readiness score. */
  weight: number
  passed: boolean
  detail: string
}

export type ReadinessLabel = 'Not Ready' | 'Needs Review' | 'Ready' | 'Execution Ready'

// ---------------------------------------------------------------------------
// Complete simulation result
// ---------------------------------------------------------------------------

export interface StageSummary {
  stage: ExecutionStage
  total: number
  succeeded: number
  warnings: number
  failed: number
  blocked: number
  skipped: number
}

export interface SimulationResult {
  // Execution pipeline
  executionOrder: ExecutionStep[]
  stageSummaries: StageSummary[]

  // Dependencies
  dependencies: Dependency[]
  criticalDependenciesMissing: number
  dependenciesResolved: number

  // Rollback
  rollbackEntries: RollbackEntry[]
  rollbackReady: boolean

  // Dry Run
  dryRunSteps: DryRunStep[]
  dryRunSucceeded: number
  dryRunWarnings: number
  dryRunFailed: number
  dryRunSkipped: number
  dryRunBlocked: number

  // Readiness
  readinessScore: number
  readinessLabel: ReadinessLabel
  readinessFactors: ReadinessFactor[]

  // Summary
  estimatedExecutionTimeMs: number
  totalFamiliesPlanned: number
  totalLayersAffected: number

  // Issues
  blockedFamilyIds: string[]
  simulationWarnings: string[]
  simulationErrors: string[]
}
