import * as XLSX from 'xlsx'
import { buildWorkbook } from './workbook-builder'
import type { ExportData } from './types'

function arrayToBase64(arr: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i])
  return btoa(binary)
}

export function exportWorkbook(data: ExportData): void {
  const wb = buildWorkbook(data)
  const timestamp = new Date().toISOString().slice(0, 10)
  const scope = data.result.scopeLabel.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
  const fileName = `Refactor-Typography-${scope}-${timestamp}.xlsx`

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array

  try {
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    const b64 = arrayToBase64(wbout)
    const a = document.createElement('a')
    a.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${b64}`
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
}
