import { registerModule, registerAdapter, getAdapter } from '../engine/registry'
import { scanEngine } from '../engine/core'
import { _traversalInstrument } from '../engine/traversal'
import { _grouperInstrument } from '../engine/grouper'
import { typographyModule } from '../modules/typography/index'
import { typographyScannerAdapter } from '../modules/typography/adapter'
import {
  _extractionInstrument,
  resetExtractionInstrument,
  clearStyleCache,
  getDiscoveredStyles,
  preloadStyleCacheAsync,
  type PreloadStats,
} from '../modules/typography/scanner'
import { navigateToLocations } from './navigation'
import { runAllBenchmarks } from '../benchmarks/runner'
import type { UIToPluginMessage, PluginToUIMessage } from '../shared/messages'
import type { AuditResult } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'
import type { AvailableTextStyle, AvailableTypographyVariable } from '../shared/migration'

registerModule(typographyModule)
registerAdapter(typographyScannerAdapter)

figma.showUI(__html__, { width: 860, height: 620, themeColors: true })

// Set true for per-entry object logs and sample payloads.
const DEBUG = false

let scanCancelled = false
function send(msg: PluginToUIMessage): void { figma.ui.postMessage(msg) }

// ---------------------------------------------------------------------------
// Source classification
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
// Sprint A: Foundation Coverage Report
//
// Printed after every scan. Covers:
//   1. Text style coverage (applied vs resolved)
//   2. Source distribution (how signatures classify)
//   3. Unknown source count (must be 0)
//   4. Usage integrity (group.count === group.items.length)
// ---------------------------------------------------------------------------

function printCoverageReport(preloadStats: PreloadStats, preloadMs: number, groups: AuditResult['groups']): void {
  const W = 56
  const line = '═'.repeat(W)
  const mid  = '─'.repeat(W)
  const pct  = (n: number, d: number): string => d > 0 ? `${Math.round(n/d*100)}%` : 'N/A'

  console.log('')
  console.log(`  ╔${line}╗`)
  console.log(`  ║  Sprint A — Foundation Coverage Report${' '.repeat(W-40)}║`)
  console.log(`  ╠${line}╣`)

  // Performance
  console.log(`  ║  Preload:${' '.repeat(W-9)}║`)
  console.log(`  ║    time:              ${String(preloadMs+'ms').padStart(8)}${' '.repeat(W-31)}║`)

  console.log(`  ╠${mid}╣`)

  // Text Style Coverage
  const styleCov = pct(preloadStats.resolved, preloadStats.totalIds)
  const styleFlag = preloadStats.unresolved === 0 ? '✓' : '✗'
  console.log(`  ║  Text Styles${' '.repeat(W-13)}║`)
  console.log(`  ║    Applied (unique IDs): ${String(preloadStats.totalIds).padStart(6)}${' '.repeat(W-35)}║`)
  console.log(`  ║    Resolved — local:    ${String(preloadStats.localCount).padStart(6)}${' '.repeat(W-35)}║`)
  console.log(`  ║    Resolved — library:  ${String(preloadStats.libraryCount).padStart(6)}${' '.repeat(W-35)}║`)
  console.log(`  ║    Unresolved:          ${String(preloadStats.unresolved).padStart(6)}${' '.repeat(W-35)}║`)
  console.log(`  ║    Coverage:            ${(styleCov+' '+styleFlag).padStart(8)}${' '.repeat(W-37)}║`)

  console.log(`  ╠${mid}╣`)

  // Source Distribution
  const total = groups.length
  const dist: Record<string, number> = {}
  for (const g of groups) { const s = g.source ?? 'Unknown'; dist[s] = (dist[s] ?? 0) + 1 }
  const unknown = dist['Unknown'] ?? 0
  console.log(`  ║  Source Distribution (${total} signatures)${' '.repeat(Math.max(0,W-24-String(total).length))}║`)
  const srcOrder = ['Raw Values','Local Text Style','Library Text Style','Variable','Unknown']
  for (const src of srcOrder) {
    const n   = dist[src] ?? 0
    const p   = total > 0 ? Math.round(n/total*100) : 0
    const flag = src === 'Unknown' ? (n > 0 ? ' ✗' : ' ✓') : ''
    const label = `${src}:`.padEnd(24)
    const value = `${n} (${p}%)${flag}`
    console.log(`  ║    ${label} ${value.padStart(10)}${' '.repeat(Math.max(0,W-5-24-11))}║`)
  }

  console.log(`  ╠${mid}╣`)

  // Usage Integrity
  let usageErrors = 0
  for (const g of groups) {
    if (g.count !== g.items.length) {
      usageErrors++
      console.error(`  [Refactor] USAGE ERROR "${g.label}": count=${g.count} items=${g.items.length}`)
    }
  }
  const usageFlag = usageErrors === 0 ? '✓' : `✗ ${usageErrors} error(s)`
  console.log(`  ║  Usage Integrity: ${usageFlag}${' '.repeat(Math.max(0,W-18-usageFlag.length))}║`)

  if (unknown > 0) {
    console.log(`  ╠${mid}╣`)
    console.log(`  ║  SOURCE ERROR: ${unknown} signature(s) have Unknown source${' '.repeat(Math.max(0,W-38-String(unknown).length))}║`)
    console.error(`[Refactor] ${unknown} Unknown source(s) found — review resolveSource() and classifyGroupSources()`)
  }

  console.log(`  ╚${line}╝`)
  console.log('')
}

// ---------------------------------------------------------------------------
// Profiler helpers
// ---------------------------------------------------------------------------

function fmtMs(ms: number): string {
  if (ms >= 10000) return `${(ms/1000).toFixed(1)}s `
  if (ms >= 1000)  return `${(ms/1000).toFixed(2)}s`
  return `${ms}ms`
}
function fmtN(n: number): string { return n.toLocaleString() }
function fmtRate(items: number, ms: number): string {
  if (ms <= 0) return '        —'
  const r = Math.round((items/ms)*1000)
  if (r >= 1_000_000) return `${(r/1_000_000).toFixed(1)}M/s`
  if (r >= 1_000)     return `${Math.round(r/1_000)}K/s`
  return `${r}/s`
}
function pct(ms: number, totalMs: number): string {
  if (totalMs <= 0) return '   0.0%'
  return `${((ms/totalMs)*100).toFixed(1).padStart(5)}%`
}

function printDetailedReport(totalMs: number, serialMs: number, msgMs: number, scope: string, groupCount: number): void {
  const ti = _traversalInstrument, ei = _extractionInstrument, gi = _grouperInstrument, t = scanEngine.timings
  const N = ti.itemsExtracted, V = ti.nodesVisited
  const propMs = ei.fontNameMs+ei.fontSizeMs+ei.lineHeightMs+ei.letterSpacingMs+ei.textCaseMs+ei.textDecorationMs+ei.textStyleIdMs
  const propN  = ei.fontNameAccesses+ei.fontSizeAccesses+ei.lineHeightAccesses+ei.letterSpacingAccesses+ei.textCaseAccesses+ei.textDecorationAccesses+ei.textStyleIdAccesses
  const W = 72, line = '═'.repeat(W), mid = '─'.repeat(W)
  function row(num: string, label: string, ms: number, items: number, il = ''): void {
    console.log(`  ${(num+'  '+label).padEnd(28)}${fmtMs(ms).padStart(9)}   ${pct(ms,totalMs)}  ${items>0?fmtN(items).padStart(9):'        —'}  ${items>0?fmtRate(items,ms).padStart(12):'           —'}  ${il}`)
  }
  void gi
  console.log('')
  console.log(`  ╔${line}╗`)
  console.log(`  ║  Scan Profile (${scope})${' '.repeat(Math.max(0,W-14-scope.length))}║`)
  console.log(`  ╠${line}╣`)
  row('1','Traversal',    ti.traversalMs,      V,'nodes')
  row('4','Extraction',   ei.extractionCallMs, N,'nodes')
  console.log(`  ║  ${'    IPC total'.padEnd(28)}${fmtMs(propMs).padStart(9)}   ${pct(propMs,totalMs)}  ${fmtN(propN).padStart(9)}  ${fmtRate(propN,propMs).padStart(12)}  calls║`)
  row('7','Grouping',     t.groupingMs,        N,'items')
  row('8','Sorting',      t.sortingMs,         groupCount,'groups')
  row('9','Serialization',serialMs,            N,'items')
  console.log(`  ╠${mid}╣`)
  console.log(`  ║  Total${' '.repeat(W-6)} ${fmtMs(totalMs).padStart(9)}║`)
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
      const pageIds = new Set(locations.map(l => l.pageId))
      if (pageIds.size > 1) { send({ type: 'SHOW_USAGE_EXPLORER' }); break }
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
      const tPlan = Date.now()
      const textStyles: AvailableTextStyle[] = []
      const variables: AvailableTypographyVariable[] = []
      let localCount = 0, libraryCount = 0

      // ── Stage 1: local text styles ────────────────────────────────────────
      let localStyleIds = new Set<string>()
      try {
        const localStylesList = await figma.getLocalTextStylesAsync()
        localCount = localStylesList.length
        localStyleIds = new Set(localStylesList.map(s => s.id))
        for (const s of localStylesList) {
          const fn = s.fontName as FontName
          textStyles.push({ id: s.id, name: s.name, fontFamily: fn.family, fontStyle: fn.style, fontSize: s.fontSize as number, isLocal: true })
        }
        if (DEBUG) console.log(`[DEBUG] local styles: ${localCount}`)
      } catch (err) {
        console.error('[Refactor] GET_PLANNING_DATA stage 1 (local) failed:', err)
      }

      // ── Stage 2: library styles from scan cache ──────────────────────────
      try {
        const discoveredStyles = getDiscoveredStyles()
        let noFontDropped = 0

        for (const [styleId, cached] of discoveredStyles) {
          if (!cached || !cached.remote || localStyleIds.has(styleId)) continue
          if (!cached.fontFamily || !cached.fontStyle || cached.fontSize == null) {
            noFontDropped++
            continue
          }
          const segments = cached.name.split('/')
          textStyles.push({
            id: styleId, name: cached.name,
            fontFamily: cached.fontFamily, fontStyle: cached.fontStyle, fontSize: cached.fontSize,
            isLocal: false,
            libraryName: segments.length > 1 ? segments[0].trim() : undefined,
          })
          libraryCount++
        }

        if (noFontDropped > 0) console.warn(`[Refactor] ${noFontDropped} library style(s) missing font props — excluded from payload`)
        if (DEBUG) console.log(`[DEBUG] library styles: ${libraryCount}`)
      } catch (err) {
        console.error('[Refactor] GET_PLANNING_DATA stage 2 (library) failed:', err)
      }

      // ── Stage 3: variables ──────────────────────────────────────────────
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

      // ── Verification ────────────────────────────────────────────────
      const cacheView = getDiscoveredStyles()
      const cacheLibrary    = [...cacheView.values()].filter(c => c &&  c.remote).length
      const cacheUnresolved = [...cacheView.values()].filter(c => c === null).length
      const planMs = Date.now() - tPlan

      console.log(`[Refactor] Planning data — local:${localCount} library:${libraryCount} total:${textStyles.length} vars:${variables.length} (${planMs}ms)`)
      console.log(`[Refactor] Cache state   — library:${cacheLibrary} unresolved:${cacheUnresolved}`)

      if (libraryCount !== cacheLibrary) {
        console.warn(`[Refactor] ASSERT: cache.library(${cacheLibrary}) ≠ payload.library(${libraryCount}) — ${cacheLibrary-libraryCount} dropped`)
      }
      if (textStyles.length !== localCount + libraryCount) {
        console.error(`[Refactor] ASSERT FAILED: total(${textStyles.length}) ≠ local(${localCount})+library(${libraryCount})`)
      }

      send({ type: 'PLANNING_DATA', payload: { textStyles, variables } })
      break
    }

    case 'START_SCAN': {
      const { moduleId, scope } = msg.payload
      const adapter = getAdapter(moduleId)
      if (!adapter) { send({ type: 'SCAN_ERROR', payload: { error: `No adapter for "${moduleId}".` } }); return }

      scanCancelled = false
      const tTotal = Date.now()

      clearStyleCache()
      resetExtractionInstrument()
      send({ type: 'SCAN_STARTED', payload: { moduleId, scope } })

      // Phase 1: resolve all textStyleIds async BEFORE the sync extraction pass.
      const tPreload = Date.now()
      const preloadStats = await preloadStyleCacheAsync(scope)
      const preloadMs = Date.now() - tPreload

      if (scanCancelled) { send({ type: 'SCAN_CANCELLED' }); return }

      try {
        const { items, groups } = await scanEngine.run(
          adapter, scope, () => scanCancelled,
          (progress) => { if (scanCancelled) return; send({ type: 'SCAN_PROGRESS', payload: progress }) }
        )
        if (scanCancelled) { send({ type: 'SCAN_CANCELLED' }); return }

        classifyGroupSources(groups)

        // Sprint A: Foundation Coverage Report
        printCoverageReport(preloadStats, preloadMs, groups)

        const scopeLabel = scope === 'selection' ? 'Selection' : scope === 'page' ? figma.currentPage.name : 'Entire File'
        const tSerial = Date.now()
        const result: AuditResult = { moduleId, scope, scopeLabel, totalItems: items.length, groups, scannedAt: tTotal, durationMs: Date.now()-tTotal }
        const serialMs = Date.now()-tSerial
        const tMsg = Date.now(); send({ type: 'SCAN_COMPLETE', payload: result }); const msgMs = Date.now()-tMsg
        const totalMs = Date.now()-tTotal
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
