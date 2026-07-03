import { registerModule, registerAdapter, getAdapter } from '../engine/registry'
import { scanEngine } from '../engine/core'
import { _traversalInstrument } from '../engine/traversal'
import { _grouperInstrument } from '../engine/grouper'
import { typographyModule } from '../modules/typography/index'
import { typographyScannerAdapter } from '../modules/typography/adapter'
import { _extractionInstrument, resetExtractionInstrument, clearStyleCache } from '../modules/typography/scanner'
import { navigateToLocations } from './navigation'
import { runAllBenchmarks } from '../benchmarks/runner'
import type { UIToPluginMessage, PluginToUIMessage } from '../shared/messages'
import type { AuditResult } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'
import type { AvailableTextStyle, AvailableTypographyVariable } from '../shared/migration'

registerModule(typographyModule)
registerAdapter(typographyScannerAdapter)

figma.showUI(__html__, { width: 860, height: 620, themeColors: true })

let scanCancelled = false

function send(msg: PluginToUIMessage): void { figma.ui.postMessage(msg) }

// ---------------------------------------------------------------------------
// Source classification — v0.2.1
//
// The scanner now resolves source during extraction and stores it on
// group.descriptor.source. Classification is simply a mapping from
// TypographySource.type to the legacy SourceType string.
// figma.getLocalTextStyles() is no longer needed for this step.
// ---------------------------------------------------------------------------

function classifyGroupSources(groups: AuditResult['groups']): void {
  for (const group of groups) {
    const props = group.descriptor as TypographyProperties
    const srcType = props.source?.type ?? 'Raw'
    group.source =
      srcType === 'LocalStyle'   ? 'Local Text Style'
      : srcType === 'LibraryStyle' ? 'Library Text Style'
      : srcType === 'Variable'     ? 'Variable'
      : 'Raw Values'
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers (profiler)
// ---------------------------------------------------------------------------

function fmtMs(ms: number): string {
  if (ms >= 10000) return `${(ms / 1000).toFixed(1)}s `
  if (ms >= 1000)  return `${(ms / 1000).toFixed(2)}s`
  return `${ms}ms`
}
function fmtN(n: number): string { return n.toLocaleString() }
function fmtRate(items: number, ms: number): string {
  if (ms <= 0) return '        —'
  const r = Math.round((items / ms) * 1000)
  if (r >= 1_000_000) return `${(r / 1_000_000).toFixed(1)}M/s`
  if (r >= 1_000)     return `${Math.round(r / 1_000)}K/s`
  return `${r}/s`
}
function pct(ms: number, totalMs: number): string {
  if (totalMs <= 0) return '   0.0%'
  return `${((ms / totalMs) * 100).toFixed(1).padStart(5)}%`
}

function printDetailedReport(totalMs: number, serialMs: number, msgMs: number, scope: string, groupCount: number): void {
  const ti = _traversalInstrument, ei = _extractionInstrument, gi = _grouperInstrument, t = scanEngine.timings
  const N = ti.itemsExtracted, V = ti.nodesVisited
  const propTotalMs = ei.fontNameMs + ei.fontSizeMs + ei.lineHeightMs + ei.letterSpacingMs + ei.textCaseMs + ei.textDecorationMs + ei.textStyleIdMs
  const totalIpcAccesses = ei.fontNameAccesses + ei.fontSizeAccesses + ei.lineHeightAccesses + ei.letterSpacingAccesses + ei.textCaseAccesses + ei.textDecorationAccesses + ei.textStyleIdAccesses
  const W = 76, line = '═'.repeat(W), mid = '─'.repeat(W)
  function row(num: string, label: string, ms: number, items: number, il = ''): void {
    console.log(`  ${(num+'  '+label).padEnd(30)}${fmtMs(ms).padStart(9)}   ${pct(ms,totalMs)}  ${items>0?fmtN(items).padStart(9):'        —'}  ${items>0?fmtRate(items,ms).padStart(12):'           —'}  ${il}`)
  }
  console.log('')
  console.log(`  ╔${line}╗`)
  console.log(`  ║  Refactor — Scan Profile (${scope})${' '.repeat(Math.max(0,W-26-scope.length))}║`)
  console.log(`  ╠${line}╣`)
  row('1','Document traversal',ti.traversalMs,V,'nodes')
  row('2','Page lookup',ti.pageLookupMs,ti.pageLookupCount,'lookups')
  row('3','Parent access',ti.parentAccessMs,ti.parentAccessCount,'accesses')
  row('4','Text extraction',ti.extractionCallMs,N,'nodes')
  console.log(`  ║  ${'    └ IPC prop reads'.padEnd(30)}${fmtMs(propTotalMs).padStart(9)}   ${pct(propTotalMs,totalMs)}  ${fmtN(totalIpcAccesses).padStart(9)}  ${fmtRate(totalIpcAccesses,propTotalMs).padStart(12)}  calls║`)
  row('5','Normalization',gi.normalizationMs,gi.normalizationCount,'items')
  row('6','Grouping total',t.groupingMs,N,'items')
  row('7','Sorting',t.sortingMs,groupCount,'groups')
  row('8','Serialization',serialMs,N,'items')
  row('9','UI messaging',msgMs,0,'')
  console.log(`  ╠${mid}╣`)
  console.log(`  ║  ${'10  Total'.padEnd(30)}${fmtMs(totalMs).padStart(9)}   100.0%${' '.repeat(W-43)}║`)
  console.log(`  ╚${line}╝`)
  console.log('')
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

figma.ui.onmessage = async (rawMsg: unknown) => {
  if ((rawMsg as { type?: string }).type === 'RUN_BENCHMARKS') {
    await runAllBenchmarks()
    return
  }

  const msg = rawMsg as UIToPluginMessage

  switch (msg.type) {
    case 'GET_SELECTION_INFO': {
      const count = figma.currentPage.selection.length
      send({ type: 'SELECTION_INFO', payload: { count, hasSelection: count > 0, currentPageId: figma.currentPage.id } })
      break
    }

    case 'SELECT_NODES': {
      const { locations } = msg.payload
      if (locations.length === 0) break

      // v0.2.1: If locations span multiple pages, tell the UI to show the
      // Usage Explorer instead of attempting cross-page native selection.
      const pageIds = new Set(locations.map(l => l.pageId))
      if (pageIds.size > 1) {
        send({ type: 'SHOW_USAGE_EXPLORER' })
        break
      }

      // All locations on one page — use existing navigation.
      const outcome = await navigateToLocations(locations)
      if (outcome.ok) {
        const { selected, pageChanged, pageName, notFound } = outcome.result
        send({ type: 'NODES_SELECTED', payload: { count: selected, pageChanged, pageName, notFound } })
      } else {
        send({ type: 'NAVIGATION_ERROR', payload: { error: outcome.error.message, code: outcome.error.code } })
      }
      break
    }

    case 'GET_PLANNING_DATA': {
      const textStyles: AvailableTextStyle[] = figma.getLocalTextStyles().map((s) => {
        const fontName = s.fontName as FontName
        return { id: s.id, name: s.name, fontFamily: fontName.family, fontStyle: fontName.style, fontSize: s.fontSize as number, isLocal: true }
      })
      const variables: AvailableTypographyVariable[] = []
      try {
        const collections = figma.variables.getLocalVariableCollections()
        for (const collection of collections) {
          for (const varId of collection.variableIds) {
            const variable = figma.variables.getVariableById(varId)
            if (variable && (variable.resolvedType === 'STRING' || variable.resolvedType === 'FLOAT')) {
              variables.push({ id: variable.id, name: variable.name, collectionName: collection.name, resolvedType: variable.resolvedType })
            }
          }
        }
      } catch { /* variables API not available */ }
      send({ type: 'PLANNING_DATA', payload: { textStyles, variables } })
      break
    }

    case 'START_SCAN': {
      const { moduleId, scope } = msg.payload
      const adapter = getAdapter(moduleId)
      if (!adapter) { send({ type: 'SCAN_ERROR', payload: { error: `No adapter for "${moduleId}".` } }); return }

      scanCancelled = false
      const tTotal = Date.now()

      // Clear style cache at start of each scan so renamed/deleted styles are fresh.
      clearStyleCache()
      resetExtractionInstrument()
      send({ type: 'SCAN_STARTED', payload: { moduleId, scope } })

      try {
        const { items, groups } = await scanEngine.run(
          adapter, scope, () => scanCancelled,
          (progress) => { if (scanCancelled) return; send({ type: 'SCAN_PROGRESS', payload: progress }) }
        )
        if (scanCancelled) { send({ type: 'SCAN_CANCELLED' }); return }

        // v0.2.1: classification now reads group.descriptor.source (set by scanner)
        classifyGroupSources(groups)

        const scopeLabel = scope === 'selection' ? 'Selection' : scope === 'page' ? figma.currentPage.name : 'Entire File'
        const tSerial = Date.now()
        const result: AuditResult = { moduleId, scope, scopeLabel, totalItems: items.length, groups, scannedAt: tTotal, durationMs: Date.now() - tTotal }
        const serialMs = Date.now() - tSerial
        const tMsg = Date.now()
        send({ type: 'SCAN_COMPLETE', payload: result })
        const msgMs = Date.now() - tMsg
        const totalMs = Date.now() - tTotal
        printDetailedReport(totalMs, serialMs, msgMs, scopeLabel, groups.length)
      } catch (err) {
        send({ type: 'SCAN_ERROR', payload: { error: err instanceof Error ? err.message : String(err) } })
      }
      break
    }

    case 'CANCEL_SCAN': { scanCancelled = true; break }
    case 'RESIZE': { figma.ui.resize(msg.payload.width, msg.payload.height); break }
  }
}
