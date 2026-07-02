// ---------------------------------------------------------------------------
// Migration Domain Model
//
// Represents the Design System Planning workflow.
// Nothing in this module modifies the Figma document.
// All values are planning intent only — applied in Sprint 5.
// ---------------------------------------------------------------------------

/**
 * The high-level approach the designer has chosen for building their
 * future typography system. Used to pre-fill defaults; every family
 * can override the strategy individually.
 */
export type MigrationStrategy =
  | 'existing-design-system'  // match families to existing styles/variables
  | 'existing-variables'       // prefer typography variables
  | 'create-new'               // define a new canonical style per family
  | 'manual'                   // user decides every family individually
  | 'hybrid'                   // mix of approaches

/** Which type of consolidation target has been chosen for a family. */
export type ConsolidationTargetType =
  | 'existing-style'
  | 'existing-variable'
  | 'new-style'
  | 'manual-values'
  | 'skip'

/** Planning lifecycle state for each Candidate Family. */
export type PlanningStatus = 'unreviewed' | 'in-progress' | 'planned' | 'skipped'

// ---------------------------------------------------------------------------
// Consolidation target types
// ---------------------------------------------------------------------------

/** Map this family to an existing Figma text style. */
export interface ExistingStyleTarget {
  type: 'existing-style'
  styleId: string
  styleName: string
  libraryName?: string
  /** Preview properties from the style (read at selection time). */
  fontFamily: string
  fontStyle: string
  fontSize: number
}

/** Map this family to an existing Figma typography variable. */
export interface ExistingVariableTarget {
  type: 'existing-variable'
  variableId: string
  variableName: string
  collectionName: string
  resolvedType: string
}

/** Define a new canonical text style (not yet created in Figma). */
export interface NewStyleTarget {
  type: 'new-style'
  /** Intended name for the new text style. */
  name: string
  fontFamily: string
  fontStyle: string
  fontWeight: number
  fontSize: number
  lineHeightUnit: 'AUTO' | 'PIXELS' | 'PERCENT'
  lineHeightValue: number
  letterSpacingUnit: 'PIXELS' | 'PERCENT'
  letterSpacingValue: number
  textCase: string
  textDecoration: string
}

/**
 * Enter raw typography values without naming them.
 * Useful for organisations not yet ready to create a design system.
 */
export interface ManualValuesTarget {
  type: 'manual-values'
  fontFamily: string
  fontStyle: string
  fontWeight: number
  fontSize: number
  lineHeightUnit: 'AUTO' | 'PIXELS' | 'PERCENT'
  lineHeightValue: number
  letterSpacingUnit: 'PIXELS' | 'PERCENT'
  letterSpacingValue: number
  textCase: string
  textDecoration: string
}

/** Intentionally exclude this family from migration. */
export interface SkipTarget {
  type: 'skip'
  reason?: string
}

export type ConsolidationTarget =
  | ExistingStyleTarget
  | ExistingVariableTarget
  | NewStyleTarget
  | ManualValuesTarget
  | SkipTarget

// ---------------------------------------------------------------------------
// Migration Plan entries
// ---------------------------------------------------------------------------

/**
 * One planning decision per Candidate Family.
 * Status transitions: unreviewed → in-progress → planned | skipped.
 */
export interface MigrationEntry {
  familyId: string
  status: PlanningStatus
  target: ConsolidationTarget | null
  userApproved: boolean
  // Denormalised summary for quick reporting (from CandidateFamily at plan init)
  affectedSignatures: number
  affectedLayers: number
  affectedPages: number
}

/**
 * The complete Migration Plan for a design system.
 *
 * Lives in memory only (Zustand store).
 * Nothing is applied to the Figma document until Sprint 5.
 */
export interface MigrationPlan {
  /** High-level strategy chosen before reviewing individual families. */
  strategy: MigrationStrategy | null
  /** Keyed by CandidateFamily.id. */
  entries: Record<string, MigrationEntry>
  createdAt: number
  updatedAt: number
}

// ---------------------------------------------------------------------------
// Planning data sourced from Figma
// ---------------------------------------------------------------------------

/** A local or library text style available for selection as a target. */
export interface AvailableTextStyle {
  id: string
  name: string
  libraryName?: string
  fontFamily: string
  fontStyle: string
  fontSize: number
  isLocal: boolean
}

/** A local variable that may be relevant for typography mapping. */
export interface AvailableTypographyVariable {
  id: string
  name: string
  collectionName: string
  resolvedType: 'STRING' | 'FLOAT' | 'BOOLEAN' | 'COLOR'
}
