import type { AuditResult } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'
import type { AssignedTarget } from '../clustering/types'
import type { EnhancedPlanningData } from '../shared/migration'

export interface ExportData {
  result: AuditResult<TypographyProperties>
  assignments: Record<string, AssignedTarget>
  enhanced: EnhancedPlanningData | null
  // Legacy fallback fields
  textStyles: import('../shared/migration').AvailableTextStyle[]
  variables: import('../shared/migration').AvailableTypographyVariable[]
}

export interface SignatureRow {
  signatureId: string
  signatureLabel: string
  signatureKey: string
  fontFamily: string
  fontWeight: number
  fontSize: number
  lineHeight: string
  letterSpacing: string
  textCase: string
  textDecoration: string
  sourceType: string
  layerCount: number
  componentCount: number
  pageCount: number
  usagePercent: string
  rank: number
  priority: string
  currentStyle: string
  currentVariable: string
  targetToken: string
  confidence: string
  status: string
  notes: string
}

export interface UsageRow {
  signatureKey: string
  page: string
  frame: string
  layerName: string
  currentStyle: string
  nodeId: string
}

export interface StyleRow {
  styleName: string
  styleId: string
  collection: string
  source: string
  fontFamily: string
  fontWeight: string
  fontSize: number
  lineHeight: string
  letterSpacing: string
  usesVariables: string
  variableCount: number
  boundVariables: string
}

export interface RecipeRow {
  targetToken: string
  fontFamilyVariable: string
  fontSizeVariable: string
  fontWeightVariable: string
  lineHeightVariable: string
  letterSpacingVariable: string
  recipeStatus: string
}

export interface SummaryRow {
  metric: string
  value: number | string
}
