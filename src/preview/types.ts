import type { CandidateFamily } from '../similarity/types'
import type { MigrationEntry } from '../shared/migration'
import type { TypographyProperties } from '../modules/typography/types'

// ---------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Very High'

// ---------------------------------------------------------------------------
// Resolved target (properties available for comparison)
// ---------------------------------------------------------------------------

/**
 * The planned target after resolving against available text styles and
 * variables. Properties that cannot be determined from available data
 * are undefined (shown as “Inherited from style” in the UI).
 */
export interface ResolvedTarget {
  type: 'existing-style' | 'existing-variable' | 'new-style' | 'manual-values' | 'skip'
  displayName: string
  // Available when type = existing-style (from AvailableTextStyle)
  // or new-style / manual-values (from target definition)
  fontFamily?: string
  fontStyle?: string
  fontWeight?: number
  fontSize?: number
  lineHeightUnit?: 'AUTO' | 'PIXELS' | 'PERCENT'
  lineHeightValue?: number
  letterSpacingUnit?: 'PIXELS' | 'PERCENT'
  letterSpacingValue?: number
  textCase?: string
  textDecoration?: string
  // For variable targets
  collectionName?: string
}

// ---------------------------------------------------------------------------
// Property change (before vs after diff)
// ---------------------------------------------------------------------------

export interface PropertyChange {
  property: string
  before: string
  after: string
  /** True when the before and after values differ. Only changed rows are highlighted. */
  changed: boolean
  /** True when the after value cannot be determined (e.g. style inherits it). */
  inherited?: boolean
}

// ---------------------------------------------------------------------------
// Conflict
// ---------------------------------------------------------------------------

export type ConflictCode =
  | 'duplicate-name'       // two families plan the same new-style name
  | 'empty-name'           // new-style target has no name
  | 'conflicting-targets'  // reserved for future detection
  | 'missing-target'       // entry is planned but target is null

export interface Conflict {
  familyId: string
  code: ConflictCode
  severity: 'error' | 'warning'
  message: string
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ValidationCode =
  | 'no-target'
  | 'style-not-found'
  | 'variable-not-found'
  | 'duplicate-name'
  | 'empty-name'

export interface ValidationIssue {
  familyId: string
  code: ValidationCode
  severity: 'error' | 'warning'
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

// ---------------------------------------------------------------------------
// Preview item (one per planned Typography Family)
// ---------------------------------------------------------------------------

export interface PreviewItem {
  familyId: string
  family: CandidateFamily
  entry: MigrationEntry
  before: TypographyProperties
  after: ResolvedTarget
  changes: PropertyChange[]  // all 7 properties; changed=true when different
  changedCount: number        // convenience: number of changed properties
  affectedLayers: number
  affectedPages: number
  affectedComponents: number
  affectedInstances: number
  affectedVariants: number
  risk: RiskLevel
  riskFactors: string[]       // human-readable explanations for the risk score
  validationIssues: ValidationIssue[]
}

// ---------------------------------------------------------------------------
// Migration statistics
// ---------------------------------------------------------------------------

export interface MigrationStatistics {
  // Audit
  totalSignatures: number
  totalFamilies: number

  // Planning
  plannedFamilies: number
  skippedFamilies: number
  unplannedFamilies: number
  existingStylesUsed: number
  variablesUsed: number
  newStylesPlanned: number
  manualTargets: number

  // Impact (planned families only)
  estimatedLayerChanges: number
  estimatedAffectedPages: number
  estimatedAffectedComponents: number

  /**
   * Estimated duplicate reduction:
   * total signatures in planned families minus number of unique planned targets.
   * Represents how many redundant styles would be consolidated.
   */
  estimatedDuplicateReduction: number

  // Quality
  conflictCount: number
  validationErrors: number
  validationWarnings: number
}
