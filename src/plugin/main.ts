import { registerModule, registerAdapter, getAdapter } from '../engine/registry'
import { scanEngine } from '../engine/core'
import { _traversalInstrument } from '../engine/traversal'
import { _grouperInstrument } from '../engine/grouper'
import { typographyModule } from '../modules/typography/index'
import { typographyScannerAdapter } from '../modules/typography/adapter'
import {
  _extractionInstrument, resetExtractionInstrument,
  clearStyleCache, preloadStyleCacheAsync, type PreloadStats,
} from '../modules/typography/scanner'
import { buildCatalogAsync, getCatalogStyles, clearCatalogCache } from './catalog'
import { generatePreview } from './preview-engine'
import { runApplyEngine } from './apply-engine'
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
  for (const g of groups) {
    const src = (g.descriptor as TypographyProperties).source?.type ?? 'Raw'
    g.source = src === 'LocalStyle' ? 'Local Text Style' : src === 'LibraryStyle' ? 'Library Text Style' : src === 'Variable' ? 'Variable' : 'Raw Values'
  }
}

function logCoverage(ps: PreloadStats, ms: number, groups: AuditResult['groups']): void {
  const cat = getCatalogStyles()
  const pct = ps.totalIds > 0 ? `${Math.round(ps.resolved/ps.totalIds*100)}%` : 'N/A'
  console.log(`[Refactor] Coverage: preload=${ms}ms resolved=${ps.resolved}/${ps.totalIds}(${pct}) catalog=${cat.filter(s=>s.isLocal).length}L+${cat.filter(s=>!s.isLocal).length}Lib`)
  const dist: Record<string,number> = {}; for (const g of groups) { const s = g.source??'Unknown'; dist[s]=(dist[s]??0)+1 }
  console.log('[Refactor] Sources:', Object.entries(dist).map(([k,v])=>`${k}:${v}`).join(' | '))
  const unknown = dist['Unknown']??0; if (unknown > 0) console.error(`[Refactor] ${unknown} Unknown source(s)`)
  for (const g of groups) if (g.count !== g.items.length) console.error(`[Refactor] USAGE ERROR "${g.label}"`)
}

figma.ui.onmessage = async (rawMsg: unknown) => {
  if ((rawMsg as { type?: string }).type === 'RUN_BENCHMARKS') { await runAllBenchmarks(); return }
  const msg = rawMsg as UIToPluginMessage
  switch (msg.type) {
    case 'GET_SELECTION_INFO': {
      const count = figma.currentPage.selection.length
      send({ type: 'SELECTION_INFO', payload: { count, hasSelection: count > 0, currentPageId: figma.currentPage.id } }); break
    }
    case 'SELECT_NODES': {
      const { locations } = msg.payload
      if (!locations.length) break
      if (new Set(locations.map(l=>l.pageId)).size > 1) { send({ type: 'SHOW_USAGE_EXPLORER' }); break }
      const out = await navigateToLocations(locations)
      if (out.ok) { const { selected, pageChanged, pageName, notFound } = out.result; send({ type: 'NODES_SELECTED', payload: { count: selected, pageChanged, pageName, notFound } }) }
      else send({ type: 'NAVIGATION_ERROR', payload: { error: out.error.message, code: out.error.code } })
      break
    }
    case 'REVIEW_NAVIGATE': {
      const { pageId, layerIds } = msg.payload
      try {
        const page = figma.root.children.find(p => p.id === pageId)
        if (!page || page.type !== 'PAGE') { send({ type: 'REVIEW_NAVIGATED', payload: { success: false } }); break }
        await figma.setCurrentPageAsync(page as PageNode)
        // figma.getNodeById is forbidden in dynamic-page mode — must use async variant
        const nodes: SceneNode[] = []
        for (const id of layerIds) {
          const n = await figma.getNodeByIdAsync(id)
          if (n && n.type === 'TEXT') nodes.push(n as unknown as SceneNode)
        }
        if (nodes.length) { figma.currentPage.selection = nodes; figma.viewport.scrollAndZoomIntoView(nodes) }
        send({ type: 'REVIEW_NAVIGATED', payload: { success: true } })
      } catch (err) {
        console.error('[Refactor] REVIEW_NAVIGATE failed:', err)
        send({ type: 'REVIEW_NAVIGATED', payload: { success: false } })
      }
      break
    }
    case 'REVIEW_CLEAR_HIGHLIGHTS': { try { figma.currentPage.selection = [] } catch {}; break }
    case 'GENERATE_PREVIEW': {
      const { itemId, pageId, layerIds, mutations } = msg.payload
      try { const r = await generatePreview(pageId, layerIds, mutations); send({ type: 'PREVIEW_READY', payload: { itemId, before: r.before, after: r.after } }) }
      catch (err) { send({ type: 'PREVIEW_ERROR', payload: { itemId, error: err instanceof Error ? err.message : String(err) } }) }
      break
    }
    case 'APPLY_PLAN': {
      const { entries } = msg.payload
      console.log(`[Refactor] APPLY_PLAN: ${entries.length} entries`)
      try {
        const report = await runApplyEngine(entries, (p) => send({ type: 'APPLY_PROGRESS', payload: p }))
        send({ type: 'APPLY_COMPLETE', payload: report })
      } catch (err) {
        console.error('[Refactor] APPLY_PLAN failed:', err)
        send({ type: 'APPLY_COMPLETE', payload: { startedAt: Date.now(), completedAt: Date.now(), durationMs: 0, totalNodes: entries.length, successful: 0, skipped: 0, failed: entries.length, blocked: 0, results: [] } })
      }
      break
    }
    case 'GET_PLANNING_DATA': {
      const tPlan = Date.now()
      let textStyles: AvailableTextStyle[] = getCatalogStyles()
      if (!textStyles.length) {
        try {
          const local = await figma.getLocalTextStylesAsync()
          for (const s of local) { const fn = s.fontName as FontName; if (!fn || typeof fn.family !== 'string') continue; textStyles.push({ id: s.id, name: s.name, fontFamily: fn.family, fontStyle: fn.style, fontSize: typeof s.fontSize === 'number' ? s.fontSize : 0, isLocal: true }) }
        } catch (err) { console.error('[Refactor] planning fallback:', err) }
      }
      const variables: AvailableTypographyVariable[] = []
      try {
        for (const c of figma.variables.getLocalVariableCollections()) {
          for (const id of c.variableIds) { const v = figma.variables.getVariableById(id); if (v && (v.resolvedType === 'STRING' || v.resolvedType === 'FLOAT')) variables.push({ id: v.id, name: v.name, collectionName: c.name, resolvedType: v.resolvedType }) }
        }
      } catch {}
      const l = textStyles.filter(s=>s.isLocal).length, lib = textStyles.filter(s=>!s.isLocal).length
      console.log(`[Refactor] Planning: ${l}+${lib}=${textStyles.length} styles ${variables.length} vars (${Date.now()-tPlan}ms)`)
      if (DEBUG) console.log('[DEBUG]', JSON.stringify(textStyles.slice(0,3)))
      send({ type: 'PLANNING_DATA', payload: { textStyles, variables } }); break
    }
    case 'START_SCAN': {
      const { moduleId, scope } = msg.payload
      const adapter = getAdapter(moduleId)
      if (!adapter) { send({ type: 'SCAN_ERROR', payload: { error: `No adapter for "${moduleId}".` } }); return }
      scanCancelled = false; const tTotal = Date.now()
      clearStyleCache(); clearCatalogCache(); resetExtractionInstrument()
      send({ type: 'SCAN_STARTED', payload: { moduleId, scope } })
      const tPre = Date.now(); const ps = await preloadStyleCacheAsync(scope); const preMs = Date.now()-tPre
      if (scanCancelled) { send({ type: 'SCAN_CANCELLED' }); return }
      try {
        const { items, groups } = await scanEngine.run(adapter, scope, ()=>scanCancelled, (p)=>{ if (!scanCancelled) send({ type: 'SCAN_PROGRESS', payload: p }) })
        if (scanCancelled) { send({ type: 'SCAN_CANCELLED' }); return }
        classifyGroupSources(groups)
        try { await buildCatalogAsync(scope) } catch (err) { console.error('[Refactor] catalog build failed:', err) }
        logCoverage(ps, preMs, groups)
        const sl = scope === 'selection' ? 'Selection' : scope === 'page' ? figma.currentPage.name : 'Entire File'
        const result: AuditResult = { moduleId, scope, scopeLabel: sl, totalItems: items.length, groups, scannedAt: tTotal, durationMs: Date.now()-tTotal }
        send({ type: 'SCAN_COMPLETE', payload: result })
        void _grouperInstrument; void _traversalInstrument; void _extractionInstrument; void scanEngine.timings
        console.log(`[Refactor] Scan: ${Date.now()-tTotal}ms | ${groups.length} groups`)
      } catch (err) { send({ type: 'SCAN_ERROR', payload: { error: err instanceof Error ? err.message : String(err) } }) }
      break
    }
    case 'CANCEL_SCAN': { scanCancelled = true; break }
    case 'RESIZE': { figma.ui.resize(msg.payload.width, msg.payload.height); break }
  }
}
