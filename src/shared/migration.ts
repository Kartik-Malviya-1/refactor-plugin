// ---------------------------------------------------------------------------
// Migration Domain Model
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
  | 'new-variable'
  | 'manual-values'
  | 'skip'

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
  /**
   * Which VariableBindableTextField to bind this variable to.
   * If omitted, the apply engine auto-selects based on resolvedType:
   *   FLOAT   → 'fontSize'
   *   STRING  → 'fontFamily'
   */
  targetField?: 'fontFamily' | 'fontSize' | 'fontStyle' | 'fontWeight' | 'letterSpacing' | 'lineHeight' | 'paragraphSpacing' | 'paragraphIndent'
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

export interface NewVariableTarget {
  type: 'new-variable'
  variableName: string
  collectionName: string
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
  | NewVariableTarget
  | ManualValuesTarget
  | SkipTarget

export interface MigrationEntry {
  familyId: string
  status: PlanningStatus
  target: ConsolidationTarget | null
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
