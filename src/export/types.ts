import type { AuditResult } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'

export interface ExportData {
  result: AuditResult<TypographyProperties>
}

export interface SignatureRow {
  signatureId: string
  signatureLabel: string
  fontFamily: string
  weightName: string
  weightValue: number
  fontSize: number
  lineHeight: string
  letterSpacing: string
  textCase: string
  textDecoration: string
  layerCount: number
  pageCount: number
  componentCount: number
  exampleText: string
  currentStyle: string
  source: string
}
