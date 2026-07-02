// ---------------------------------------------------------------------------
// Migration Domain Model — Sprint 5 update
//
// PlanningStatus renamed to reflect user-facing terminology.
// SmartSuggestion-related types live in src/suggestions/types.ts.
// Nothing in this module modifies the Figma document.
// ---------------------------------------------------------------------------

export type MigrationStrategy =
  | 'existing-design-system'
  | 'existing-variables'
  | 'create-new'
  | 'manual'
  | 'hybrid'

export type ConsolidationTargetType =
  | 'existing-style'
  | 'existing-variable'
  | 'new-style'
  | 'manual-values'
  | 'skip'

/**
 * Planning lifecycle for each Typography Family.
 *
 * needs-review        — no action taken yet, no suggestions shown
 * suggestions-available — one or more suggestions computed, awaiting decision
 * planned             — target confirmed (manually or via suggestion)
 * modified            — was accepted via suggestion, then user edited the target
 * skipped             — intentionally excluded from migration
 */
export type PlanningStatus =
  | 'needs-review'
  | 'suggestions-available'
  | 'planned'
  | 'modified'
  | 'skipped'

export interface ExistingStyleTarget {
  type: 'existing-style'
  styleId: string
  styleName: string
  libraryName?: string
  fontFamily: string
  fontStyle: string
  fontSize: number
}

export interface ExistingVariableTarget {
  type: 'existing-variable'
  variableId: string
  variableName: string
  collectionName: string
  resolvedType: string
}

export interface NewStyleTarget {
  type: 'new-style'
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

export interface MigrationEntry {
  familyId: string
  status: PlanningStatus
  target: ConsolidationTarget | null
  /** True if target was set via a suggestion (not manually). */
  acceptedViaSuggestion: boolean
  userApproved: boolean
  affectedSignatures: number
  affectedLayers: number
  affectedPages: number
}

export interface MigrationPlan {
  strategy: MigrationStrategy | null
  entries: Record<string, MigrationEntry>
  createdAt: number
  updatedAt: number
}

export interface AvailableTextStyle {
  id: string
  name: string
  libraryName?: string
  fontFamily: string
  fontStyle: string
  fontSize: number
  isLocal: boolean
}

export interface AvailableTypographyVariable {
  id: string
  name: string
  collectionName: string
  resolvedType: 'STRING' | 'FLOAT' | 'BOOLEAN' | 'COLOR'
}
