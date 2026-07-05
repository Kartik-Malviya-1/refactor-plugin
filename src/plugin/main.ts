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
import { buildCatalogAsync, getCatalogStyles, clearCatalogCache } from './catalog'
import { navigateToLocations } from './navigation'
import { runAllBenchmarks } from '../benchmarks/runner'
import type { UIToPluginMessage, PluginToUIMessage } from '../shared/messages'
import type { AuditResult } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'
import type { AvailableTextStyle, AvailableTypographyVariable } from '../shared/migration'

registerModule(typographyModule)
registerAdapter(typographyScannerAdapter)

figma.showUI(__html__, { width: 860, height: 620, themeColors: true })

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
// Coverage Report
// ---------------------------------------------------------------------------

function printCoverageReport(preloadStats: PreloadStats, preloadMs: number, groups: AuditResult['groups']): void {
  const W = 58
  const line = '═'.repeat(W)
  const mid  = '─'.repeat(W)
  const pct  = (n: number, d: number): string => d > 0 ? `${Math.round(n/d*100)}%` : 'N/A'

  console.log('')
  console.log(`  ╔${line}╗`)
  console.log(`  ║  Foundation Coverage Report${' '.repeat(W-28)}║`)
  console.log(`  ╠${line}╣`)
  console.log(`  ║  Preload time: ${String(preloadMs+'ms').padStart(8)}${' '.repeat(W-23)}║`)
  console.log(`  ╠${mid}╣`)

  const styleCov  = pct(preloadStats.resolved, preloadStats.totalIds)
  const styleFlag = preloadStats.unresolved === 0 ? '✓' : '✗'
  console.log(`  ║  Text Styles (scan scope)${' '.repeat(W-25)}║`)
  console.log(`  ║    Applied: ${String(preloadStats.totalIds).padStart(6)}  Resolved: ${String(preloadStats.resolved).padStart(6)}  Coverage: ${(styleCov+' '+styleFlag).padStart(6)}${' '.repeat(Math.max(0,W-53))}║`)

  const catalog    = getCatalogStyles()
  const catLocal   = catalog.filter(s => s.isLocal).length
  const catLibrary = catalog.filter(s => !s.isLocal).length
  console.log(`  ╠${mid}╣`)
  console.log(`  ║  Style Catalog (full file) — local:${catLocal} library:${catLibrary} total:${catalog.length}${' '.repeat(Math.max(0,W-43-String(catLocal).length-String(catLibrary).length-String(catalog.length).length))}║`)

  const total = groups.length
  const dist: Record<string, number> = {}
  for (const g of groups) { const s = g.source ?? 'Unknown'; dist[s] = (dist[s] ?? 0) + 1 }
  const unknown = dist['Unknown'] ?? 0
  console.log(`  ╠${mid}╣`)
  console.log(`  ║  Source Distribution (${total} signatures)${' '.repeat(Math.max(0,W-24-String(total).length))}║`)
  for (const src of ['Raw Values','Local Text Style','Library Text Style','Variable','Unknown']) {
    const n = dist[src] ?? 0
    const p = total > 0 ? Math.round(n/total*100) : 0
    const flag = src === 'Unknown' ? (n > 0 ? ' ✗' : ' ✓') : ''
    console.log(`  ║    ${`${src}:`.padEnd(22)} ${`${n} (${p}%)${flag}`.padStart(12)}${' '.repeat(Math.max(0,W-38))}║`)
  }

  let usageErrors = 0
  for (const g of groups) if (g.count !== g.items.length) { usageErrors++; console.error(`  USAGE ERROR "${g.label}": count=${g.count} items=${g.items.length}`) }
  const usageFlag = usageErrors === 0 ? '✓' : `✗ ${usageErrors} error(s)`
  console.log(`  ╠${mid}╣`)
  console.log(`  ║  Usage Integrity: ${usageFlag}${' '.repeat(Math.max(0,W-18-usageFlag.length))}║`)
  if (unknown > 0) console.error(`[Refactor] ${unknown} Unknown source(s)`)
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
  void gi; void msgMs; void serialMs
  console.log('')
  console.log(`  ╔${line}╗`)
  console.log(`  ║  Scan Profile (${scope})${' '.repeat(Math.max(0,W-14-scope.length))}║`)
  console.log(`  ╠${line}╣`)
  row('1','Traversal',  ti.traversalMs,      V,'nodes')
  row('4','Extraction', ei.extractionCallMs, N,'nodes')
  console.log(`  ║  ${'    IPC total'.padEnd(28)}${fmtMs(propMs).padStart(9)}   ${pct(propMs,totalMs)}  ${fmtN(propN).padStart(9)}  ${fmtRate(propN,propMs).padStart(12)}  calls║`)
  row('7','Grouping',   t.groupingMs,        N,'items')
  row('8','Sorting',    t.sortingMs,         groupCount,'groups')
  console.log(`  ╠${mid}╣`)
  console.log(`  ║  Total${' '.repeat(W-6)} ${fmtMs(totalMs).padStart(9)}║`)
  console.log(`  ╚${line}╝`)
  console.log('')
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

figma.ui.onmessage = async (rawMsg: unknown) => {
  if ((rawMsg as { type?: string }).type === 'RUN_BENCHMARKS') { await runAllBenchmarks(); return }

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

    // Sprint D: navigate canvas to a review item’s frame and select changed text layers
    case 'REVIEW_NAVIGATE': {
      const { pageId, layerIds } = msg.payload
      try {
        const page = figma.root.children.find(p => p.id === pageId)
        if (!page || page.type !== 'PAGE') {
          send({ type: 'REVIEW_NAVIGATED', payload: { success: false } }); break
        }
        await figma.setCurrentPageAsync(page as PageNode)

        // Resolve text nodes on the (now current) page
        const nodes: SceneNode[] = []
        for (const id of layerIds) {
          const node = figma.getNodeById(id)
          if (node && node.type === 'TEXT') nodes.push(node as unknown as SceneNode)
        }

        if (nodes.length > 0) {
          figma.currentPage.selection = nodes
          figma.viewport.scrollAndZoomIntoView(nodes)
        }

        send({ type: 'REVIEW_NAVIGATED', payload: { success: true } })
      } catch (err) {
        console.error('[Refactor] REVIEW_NAVIGATE failed:', err)
        send({ type: 'REVIEW_NAVIGATED', payload: { success: false } })
      }
      break
    }

    // Sprint D: clear canvas selection set by review navigation
    case 'REVIEW_CLEAR_HIGHLIGHTS': {
      try { figma.currentPage.selection = [] } catch {}
      break
    }

    case 'GET_PLANNING_DATA': {
      const tPlan = Date.now()
      let textStyles: AvailableTextStyle[] = getCatalogStyles()

      if (textStyles.length === 0) {
        try {
          const local = await figma.getLocalTextStylesAsync()
          for (const s of local) {
            const fn = s.fontName as FontName
            if (!fn || typeof fn.family !== 'string') continue
            textStyles.push({ id: s.id, name: s.name, fontFamily: fn.family, fontStyle: fn.style, fontSize: typeof s.fontSize === 'number' ? s.fontSize : 0, isLocal: true })
          }
        } catch (err) { console.error('[Refactor] GET_PLANNING_DATA fallback failed:', err) }
      }

      const variables: AvailableTypographyVariable[] = []
      try {
        const collections = figma.variables.getLocalVariableCollections()
        for (const c of collections) {
          for (const varId of c.variableIds) {
            const v = figma.variables.getVariableById(varId)
            if (v && (v.resolvedType === 'STRING' || v.resolvedType === 'FLOAT')) {
              variables.push({ id: v.id, name: v.name, collectionName: c.name, resolvedType: v.resolvedType })
            }
          }
        }
      } catch {}

      const localN = textStyles.filter(s => s.isLocal).length
      const libN   = textStyles.filter(s => !s.isLocal).length
      console.log(`[Refactor] Planning data — ${localN} local + ${libN} library = ${textStyles.length} styles + ${variables.length} vars (${Date.now()-tPlan}ms)`)
      if (DEBUG) console.log('[DEBUG] first 5 styles:', JSON.stringify(textStyles.slice(0,5)))

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
      clearCatalogCache()
      resetExtractionInstrument()
      send({ type: 'SCAN_STARTED', payload: { moduleId, scope } })

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

        try { await buildCatalogAsync(scope) } catch (err) { console.error('[Refactor] catalog build failed:', err) }

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
