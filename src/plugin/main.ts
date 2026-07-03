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

// Set true to print per-entry style objects and sample payloads.
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
      // Accumulators declared before try blocks so send() always fires.
      const textStyles: AvailableTextStyle[] = []
      const variables: AvailableTypographyVariable[] = []
      let localCount = 0, libraryCount = 0

      // ── Stage 1: local text styles (getLocalTextStylesAsync — sync API does not exist) ─
      let localStyleIds = new Set<string>()
      try {
        const localStylesList = await figma.getLocalTextStylesAsync()
        localCount = localStylesList.length
        localStyleIds = new Set(localStylesList.map(s => s.id))
        for (const s of localStylesList) {
          const fn = s.fontName as FontName
          textStyles.push({ id: s.id, name: s.name, fontFamily: fn.family, fontStyle: fn.style, fontSize: s.fontSize as number, isLocal: true })
        }
        if (DEBUG) console.log(`[DEBUG] local styles from API: ${localCount}`, JSON.stringify(textStyles.slice(0,3)))
      } catch (err) {
        console.error('[Refactor] GET_PLANNING_DATA stage 1 (local) failed:', err)
      }

      // ── Stage 2: library styles from scan cache ───────────────────────────
      // Single source of truth: _styleCache populated by preloadStyleCacheAsync().
      try {
        const discoveredStyles = getDiscoveredStyles()
        let noFontDropped = 0

        for (const [styleId, cached] of discoveredStyles) {
          if (!cached)                     continue  // unresolved during preload
          if (!cached.remote)              continue  // local — already in stage 1
          if (localStyleIds.has(styleId))  continue  // safety dedupe
          if (!cached.fontFamily || !cached.fontStyle || cached.fontSize == null) {
            noFontDropped++
            if (DEBUG) console.log(`[DEBUG] library style dropped (no font props) id=${styleId}`, JSON.stringify(cached))
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
          libraryCount++
          if (DEBUG && libraryCount <= 5) console.log(`[DEBUG] library style accepted[${libraryCount}]:`, JSON.stringify(entry))
        }

        if (noFontDropped > 0) {
          console.warn(`[Refactor] WARN ${noFontDropped} library style(s) in cache missing font props — excluded from payload`)
        }
      } catch (err) {
        console.error('[Refactor] GET_PLANNING_DATA stage 2 (library cache) failed:', err)
      }

      // ── Stage 3: variables ─────────────────────────────────────────────────
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

      // ── Verification log + assertion ─────────────────────────────────────────
      const cacheView = getDiscoveredStyles()
      const cacheLibrary   = [...cacheView.values()].filter(c => c &&  c.remote).length
      const cacheUnresolved = [...cacheView.values()].filter(c => c === null).length

      console.log(`[Refactor] Planning data — local:${localCount} library:${libraryCount} total:${textStyles.length} vars:${variables.length}`)
      console.log(`[Refactor] Cache state   — library:${cacheLibrary} unresolved:${cacheUnresolved}`)

      // Assert: every resolved library cache entry should appear in payload.
      // A mismatch means some entries had missing font props (logged as WARN above).
      if (libraryCount !== cacheLibrary) {
        console.warn(`[Refactor] ASSERT library: cache(${cacheLibrary}) ≠ payload(${libraryCount}) — ${cacheLibrary - libraryCount} dropped`)
      }
      // This is tautologically true from code structure but confirms no silent drops.
      if (textStyles.length !== localCount + libraryCount) {
        console.error(`[Refactor] ASSERT FAILED: total(${textStyles.length}) ≠ local(${localCount}) + library(${libraryCount})`)
      }

      // Always send — spinner clears even if every stage above failed.
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
      // preloadStyleCacheAsync uses figma.getStyleByIdAsync() — the only
      // available style API in dynamic-page plugins.
      await preloadStyleCacheAsync(scope)

      if (scanCancelled) { send({ type: 'SCAN_CANCELLED' }); return }

      try {
        const { items, groups } = await scanEngine.run(
          adapter, scope, () => scanCancelled,
          (progress) => { if (scanCancelled) return; send({ type: 'SCAN_PROGRESS', payload: progress }) }
        )
        if (scanCancelled) { send({ type: 'SCAN_CANCELLED' }); return }

        classifyGroupSources(groups)

        // Post-scan cache summary — counts should match preload output exactly.
        // Any new null entries come from styleIds seen in extraction but absent
        // from the preload scope (e.g. instances from other pages in page scope).
        const cacheEntries   = [...getDiscoveredStyles().entries()]
        const localInCache   = cacheEntries.filter(([, c]) => c && !c.remote).length
        const libraryInCache = cacheEntries.filter(([, c]) => c &&  c.remote).length
        const unresolved     = cacheEntries.filter(([, c]) => c === null).length
        console.log(`[Refactor] Scan complete — cache: local=${localInCache} library=${libraryInCache} unresolved=${unresolved}`)

        if (DEBUG) {
          const libEntries = cacheEntries.filter(([, c]) => c && c.remote).slice(0,5)
          for (const [id, c] of libEntries) console.log(`[DEBUG] library cache entry id=${id}`, JSON.stringify(c))
        }

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
