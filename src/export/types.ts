import type { AuditGroup, AuditResult } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'
import type { AvailableTextStyle, AvailableTypographyVariable } from '../shared/migration'
import type { AssignedTarget } from '../clustering/types'

export interface ExportData {
  result: AuditResult<TypographyProperties>
  assignments: Record<string, AssignedTarget>
  textStyles: AvailableTextStyle[]
  variables: AvailableTypographyVariable[]
}

export interface SignatureRow {
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
  currentStyle: string
  currentVariable: string
  targetToken: string
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
  source: string
  fontFamily: string
  fontWeight: string
  fontSize: number
  lineHeight: string
  letterSpacing: string
  styleId: string
}

export interface RecipeRow {
  targetToken: string
  fontFamilyVariable: string
  fontSizeVariable: string
  fontWeightVariable: string
  lineHeightVariable: string
  letterSpacingVariable: string
}

export interface SummaryRow {
  metric: string
  value: number | string
}
