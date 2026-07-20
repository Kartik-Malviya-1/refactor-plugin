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

// ---------------------------------------------------------------------------
// Enhanced Discovery Types (v0.3.1)
// ---------------------------------------------------------------------------

export interface CollectionInfo {
  id: string
  name: string
  isLocal: boolean
  modes: string[]
  variableCount: number
}

export interface DiscoveredVariable {
  id: string
  name: string
  collectionId: string
  collectionName: string
  resolvedType: string
  isLocal: boolean
  resolvedValue: string | number | boolean | null
  mode: string
}

export interface StylePropertyBinding {
  property: string
  variableId: string
  variableName: string
  collectionName: string
}

export interface EnhancedTextStyle {
  id: string
  name: string
  isLocal: boolean
  libraryName?: string
  fontFamily: string
  fontStyle: string
  fontSize: number
  lineHeight: string
  letterSpacing: string
  usesVariables: boolean
  variableCount: number
  bindings: StylePropertyBinding[]
}

export interface DiagnosticsData {
  localStyleCount: number
  libraryStyleCount: number
  localVariableCount: number
  libraryVariableCount: number
  collectionCount: number
  typographyCollectionCount: number
  recipesGenerated: number
  completeRecipes: number
  partialRecipes: number
  missingRecipes: number
  failedRecipes: FailedRecipe[]
}

export interface FailedRecipe {
  styleName: string
  missingProperty: string
  reason: string
}

export interface EnhancedPlanningData {
  textStyles: EnhancedTextStyle[]
  variables: DiscoveredVariable[]
  collections: CollectionInfo[]
  diagnostics: DiagnosticsData
}
