import * as XLSX from 'xlsx'
import type { AuditGroup } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'
import type { ExportData } from './types'
import { buildSignatureRows } from './signature-sheet'

const HEADERS = [
  'Signature ID',
  'Signature Label',
  'Font Family',
  'Weight Name',
  'Weight Value',
  'Font Size',
  'Line Height',
  'Letter Spacing',
  'Text Case',
  'Text Decoration',
  'Layer Count',
  'Page Count',
  'Component Count',
  'Example Text',
  'Current Style',
  'Source',
]

function autoWidth(ws: XLSX.WorkSheet, data: Record<string, unknown>[]): void {
  if (data.length === 0) return
  const keys = Object.keys(data[0])
  ws['!cols'] = keys.map((key, i) => {
    let maxLen = HEADERS[i]?.length ?? key.length
    for (const row of data) {
      const val = row[key]
      const len = val != null ? String(val).length : 0
      if (len > maxLen) maxLen = len
    }
    return { wch: Math.min(maxLen + 2, 60) }
  })
}

export function buildWorkbook(data: ExportData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const groups = data.result.groups as AuditGroup<TypographyProperties>[]

  const rows = buildSignatureRows(groups)

  if (rows.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['No typography signatures found. Run a scan first.']])
    XLSX.utils.book_append_sheet(wb, ws, 'Raw Typography Signatures')
    return wb
  }

  // Build worksheet from rows
  const ws = XLSX.utils.json_to_sheet(rows, { header: Object.keys(rows[0]) })

  // Bold headers with correct display names
  HEADERS.forEach((h, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i })
    ws[cell] = { v: h, t: 's', s: { font: { bold: true } } }
  })

  // Auto-size columns
  autoWidth(ws, rows)

  // Freeze first row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }

  // Enable filters
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  ws['!autofilter'] = { ref: XLSX.utils.encode_range(range) }

  // Alternate row shading
  for (let r = 1; r <= rows.length; r++) {
    if (r % 2 === 0) {
      for (let c = 0; c <= HEADERS.length - 1; c++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        const existing = ws[addr]
        if (existing) {
          existing.s = { ...existing.s, fill: { fgColor: { rgb: 'F5F5F5' } } }
        }
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Raw Typography Signatures')
  return wb
}
