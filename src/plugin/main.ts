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
import { generatePreview } from './preview-engine'
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

function printCoverageReport(preloadStats: PreloadStats, preloadMs: number, groups: AuditResult['groups']): void {
  const catalog    = getCatalogStyles()
  const catLocal   = catalog.filter(s => s.isLocal).length
  const catLibrary = catalog.filter(s => !s.isLocal).length
  const pct = (n: number, d: number) => d > 0 ? `${Math.round(n/d*100)}%` : 'N/A'
  console.log(`[Refactor] Coverage: preload ${preloadMs}ms | applied=${preloadStats.totalIds} resolved=${preloadStats.resolved} (${pct(preloadStats.resolved, preloadStats.totalIds)}) | catalog: ${catLocal} local + ${catLibrary} library`)
  const total = groups.length
  const dist: Record<string, number> = {}
  for (const g of groups) { const s = g.source ?? 'Unknown'; dist[s] = (dist[s] ?? 0) + 1 }
  const unknown = dist['Unknown'] ?? 0
  console.log(`[Refactor] Sources: ${Object.entries(dist).map(([k,v]) => `${k}:${v}`).join(' | ')}`)
  if (unknown > 0) console.error(`[Refactor] ${unknown} Unknown source(s)`)
  for (const g of groups) if (g.count !== g.items.length) console.error(`[Refactor] USAGE ERROR "${g.label}": count=${g.count} items=${g.items.length}`)
  void total
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms/1000).toFixed(2)}s` : `${ms}ms`
}
function fmtN(n: number): string { return n.toLocaleString() }
function fmtRate(items: number, ms: number): string {
  if (ms <= 0) return '        —'
  const r = Math.round((items/ms)*1000)
  return r >= 1_000 ? `${Math.round(r/1_000)}K/s` : `${r}/s`
}
function pct(ms: number, totalMs: number): string {
  return totalMs > 0 ? `${((ms/totalMs)*100).toFixed(1).padStart(5)}%` : '   0.0%'
}

function printDetailedReport(totalMs: number, scope: string, groupCount: number): void {
  const ti = _traversalInstrument, ei = _extractionInstrument, gi = _grouperInstrument, t = scanEngine.timings
  const N = ti.itemsExtracted, V = ti.nodesVisited
  void gi
  console.log(`[Refactor] Scan (${scope}): ${fmtMs(totalMs)} | traversal=${fmtMs(ti.traversalMs)} extract=${fmtMs(ei.extractionCallMs)} group=${fmtMs(t.groupingMs)} sort=${fmtMs(t.sortingMs)} | ${fmtN(V)} nodes ${fmtN(N)} items ${groupCount} groups`)
  void pct; void fmtRate; void fmtN
}

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

    case 'REVIEW_NAVIGATE': {
      const { pageId, layerIds } = msg.payload
      try {
        const page = figma.root.children.find(p => p.id === pageId)
        if (!page || page.type !== 'PAGE') { send({ type: 'REVIEW_NAVIGATED', payload: { success: false } }); break }
        await figma.setCurrentPageAsync(page as PageNode)
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

    case 'REVIEW_CLEAR_HIGHLIGHTS': {
      try { figma.currentPage.selection = [] } catch {}
      break
    }

    // Sprint D — Preview Engine: clone → mutate → export → delete
    case 'GENERATE_PREVIEW': {
      const { itemId, pageId, layerIds, mutations } = msg.payload
      try {
        const result = await generatePreview(pageId, layerIds, mutations)
        send({ type: 'PREVIEW_READY', payload: { itemId, before: result.before, after: result.after } })
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        console.error(`[Refactor] GENERATE_PREVIEW failed for ${itemId}:`, err)
        send({ type: 'PREVIEW_ERROR', payload: { itemId, error } })
      }
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
        } catch (err) { console.error('[Refactor] planning fallback failed:', err) }
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
      console.log(`[Refactor] Planning data — ${localN}+${libN}=${textStyles.length} styles ${variables.length} vars (${Date.now()-tPlan}ms)`)
      if (DEBUG) console.log('[DEBUG] first 5:', JSON.stringify(textStyles.slice(0,5)))
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
        const result: AuditResult = { moduleId, scope, scopeLabel, totalItems: items.length, groups, scannedAt: tTotal, durationMs: Date.now()-tTotal }
        send({ type: 'SCAN_COMPLETE', payload: result })
        printDetailedReport(Date.now()-tTotal, scopeLabel, groups.length)
      } catch (err) {
        send({ type: 'SCAN_ERROR', payload: { error: err instanceof Error ? err.message : String(err) } })
      }
      break
    }

    case 'CANCEL_SCAN': { scanCancelled = true; break }
    case 'RESIZE': { figma.ui.resize(msg.payload.width, msg.payload.height); break }
  }
}
