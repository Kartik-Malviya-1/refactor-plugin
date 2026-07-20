import * as XLSX from 'xlsx'
import type { AuditGroup } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'
import type { ExportData } from './types'
import { buildSignatureRows } from './signature-sheet'
import { buildUsageRows } from './usage-sheet'
import { buildStyleRows } from './styles-sheet'
import { buildRecipeRows } from './recipe-sheet'
import { buildSummaryRows } from './summary-sheet'

const HEADER_STYLE = { font: { bold: true } }

function autoWidth(ws: XLSX.WorkSheet, data: Record<string, unknown>[]): void {
  if (data.length === 0) return
  const keys = Object.keys(data[0])
  ws['!cols'] = keys.map(key => {
    let maxLen = key.length
    for (const row of data) {
      const val = row[key]
      const len = val != null ? String(val).length : 0
      if (len > maxLen) maxLen = len
    }
    return { wch: Math.min(maxLen + 2, 60) }
  })
}

function addSheet(
  wb: XLSX.WorkBook,
  name: string,
  headers: string[],
  rows: Record<string, unknown>[],
): XLSX.WorkSheet {
  const ws = XLSX.utils.json_to_sheet(rows, { header: Object.keys(rows[0] ?? {}) })

  headers.forEach((h, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i })
    ws[cell] = { v: h, t: 's', s: HEADER_STYLE }
  })

  autoWidth(ws, rows)

  ws['!freeze'] = { xSplit: 0, ySplit: 1 }

  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  ws['!autofilter'] = { ref: XLSX.utils.encode_range(range) }

  XLSX.utils.book_append_sheet(wb, ws, name)
  return ws
}

export function buildWorkbook(data: ExportData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const groups = data.result.groups as AuditGroup<TypographyProperties>[]

  const sigRows = buildSignatureRows(groups, data.assignments)
  if (sigRows.length > 0) {
    addSheet(wb, 'Raw Typography Signatures', [
      'Signature Key', 'Font Family', 'Font Weight', 'Font Size',
      'Line Height', 'Letter Spacing', 'Text Case', 'Text Decoration',
      'Source Type', 'Layer Count', 'Component Count', 'Page Count',
      'Current Style', 'Current Variable',
      'Target Token', 'Status', 'Notes',
    ], sigRows)
  } else {
    const ws = XLSX.utils.aoa_to_sheet([['No signatures found']])
    XLSX.utils.book_append_sheet(wb, ws, 'Raw Typography Signatures')
  }

  const usageRows = buildUsageRows(groups)
  if (usageRows.length > 0) {
    addSheet(wb, 'Usage Report', [
      'Signature Key', 'Page', 'Frame', 'Layer Name', 'Current Style', 'Node ID',
    ], usageRows)
  } else {
    const ws = XLSX.utils.aoa_to_sheet([['No usage data']])
    XLSX.utils.book_append_sheet(wb, ws, 'Usage Report')
  }

  const styleRows = buildStyleRows(data.textStyles)
  if (styleRows.length > 0) {
    addSheet(wb, 'Existing Typography Styles', [
      'Style Name', 'Source', 'Font Family', 'Font Weight',
      'Font Size', 'Line Height', 'Letter Spacing', 'Style ID',
    ], styleRows)
  } else {
    const ws = XLSX.utils.aoa_to_sheet([['No styles found']])
    XLSX.utils.book_append_sheet(wb, ws, 'Existing Typography Styles')
  }

  const recipeRows = buildRecipeRows(data.variables)
  if (recipeRows.length > 0) {
    addSheet(wb, 'Typography Recipes', [
      'Target Token', 'Font Family Variable', 'Font Size Variable',
      'Font Weight Variable', 'Line Height Variable', 'Letter Spacing Variable',
    ], recipeRows)
  } else {
    const ws = XLSX.utils.aoa_to_sheet([['No typography variables found']])
    XLSX.utils.book_append_sheet(wb, ws, 'Typography Recipes')
  }

  const summaryRows = buildSummaryRows(groups, data.textStyles, data.variables)
  addSheet(wb, 'Summary', ['Metric', 'Value'], summaryRows)

  return wb
}
