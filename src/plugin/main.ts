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
  row('4','Extraction',   ti.extractionCallMs, N,'nodes')
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
      const textStyles: AvailableTextStyle[] = []
      const variables: AvailableTypographyVariable[] = []

      // ── Stage 1: local text styles (async API — sync does not exist) ──────────
      let localStyleIds = new Set<string>()
      try {
        const localStylesList = await figma.getLocalTextStylesAsync()
        localStyleIds = new Set(localStylesList.map(s => s.id))
        for (const s of localStylesList) {
          const fn = s.fontName as FontName
          textStyles.push({ id: s.id, name: s.name, fontFamily: fn.family, fontStyle: fn.style, fontSize: s.fontSize as number, isLocal: true })
        }
        console.log(`[TRACE S1] local styles: ${localStylesList.length}`)
        if (localStylesList.length > 0) console.log('[TRACE S1] sample:', JSON.stringify(textStyles.slice(0,3)))
      } catch (err) {
        console.error('[TRACE S1] FAILED:', err)
      }

      // ── Stage 2: library styles from scan cache ──────────────────────────
      try {
        const discoveredStyles = getDiscoveredStyles()
        console.log(`[TRACE S2] _styleCache total entries: ${discoveredStyles.size}`)

        let skipNull = 0, skipLocal = 0, skipDupe = 0, skipNoFont = 0, accepted = 0

        for (const [styleId, cached] of discoveredStyles) {
          if (!cached)                     { skipNull++;   continue }
          if (!cached.remote)              { skipLocal++;  continue }
          if (localStyleIds.has(styleId))  { skipDupe++;   continue }
          if (!cached.fontFamily || !cached.fontStyle || cached.fontSize == null) {
            skipNoFont++
            console.log(`[TRACE S2] SKIP no-font-props id=${styleId} cached=`, JSON.stringify(cached))
            continue
          }
          const segments = cached.name.split('/')
          const entry: AvailableTextStyle = {
            id: styleId, name: cached.name,
            fontFamily: cached.fontFamily, fontStyle: cached.fontStyle, fontSize: cached.fontSize,
            isLocal: false,
            libraryName: segments.length > 1 ? segments[0].trim() : undefined,
          }
          textStyles.push(entry)
          accepted++
          if (accepted <= 5) console.log(`[TRACE S2] accepted[${accepted}]:`, JSON.stringify(entry))
        }
        console.log(`[TRACE S2] cache breakdown — total:${discoveredStyles.size} null:${skipNull} local:${skipLocal} dupe:${skipDupe} no-font:${skipNoFont} accepted:${accepted}`)
      } catch (err) {
        console.error('[TRACE S2] FAILED:', err)
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

      console.log(`[TRACE S3] PLANNING_DATA payload — textStyles:${textStyles.length} variables:${variables.length}`)
      if (textStyles.length > 0) console.log('[TRACE S3] first 5 textStyles:', JSON.stringify(textStyles.slice(0,5)))

      // Always send — even if every stage above failed, the UI gets a response
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
      // figma.getStyleByIdAsync() is the only available style API in
      // dynamic-page plugins — the synchronous getStyleById() does not exist.
      await preloadStyleCacheAsync(scope)

      if (scanCancelled) { send({ type: 'SCAN_CANCELLED' }); return }

      try {
        const { items, groups } = await scanEngine.run(
          adapter, scope, () => scanCancelled,
          (progress) => { if (scanCancelled) return; send({ type: 'SCAN_PROGRESS', payload: progress }) }
        )
        if (scanCancelled) { send({ type: 'SCAN_CANCELLED' }); return }

        classifyGroupSources(groups)

        const cacheEntries   = [...getDiscoveredStyles().entries()]
        const localInCache   = cacheEntries.filter(([, c]) => c && !c.remote).length
        const libraryInCache = cacheEntries.filter(([, c]) => c &&  c.remote).length
        const unresolved     = cacheEntries.filter(([, c]) => c === null).length
        const noFontProps    = cacheEntries.filter(([, c]) => c && c.remote && (!c.fontFamily || !c.fontStyle || c.fontSize == null)).length
        console.log(`[TRACE SCAN] cache after scan — total:${cacheEntries.length} local:${localInCache} library:${libraryInCache} unresolved:${unresolved} library-no-font-props:${noFontProps}`)

        const libEntries = cacheEntries.filter(([, c]) => c && c.remote).slice(0,5)
        for (const [id, c] of libEntries) console.log(`[TRACE SCAN] library entry id=${id}`, JSON.stringify(c))

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
