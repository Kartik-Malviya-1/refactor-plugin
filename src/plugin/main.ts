import { registerModule, registerAdapter, getAdapter } from '../engine/registry'
import { scanEngine } from '../engine/core'
import { _traversalInstrument } from '../engine/traversal'
import { _grouperInstrument } from '../engine/grouper'
import { typographyModule } from '../modules/typography/index'
import { typographyScannerAdapter } from '../modules/typography/adapter'
import { _extractionInstrument, resetExtractionInstrument } from '../modules/typography/scanner'
import { navigateToLocations } from './navigation'
import { runAllBenchmarks } from '../benchmarks/runner'
import type { UIToPluginMessage, PluginToUIMessage } from '../shared/messages'
import type { AuditResult, SourceType } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'

registerModule(typographyModule)
registerAdapter(typographyScannerAdapter)

figma.showUI(__html__, { width: 860, height: 620, themeColors: true })

let scanCancelled = false

function send(msg: PluginToUIMessage): void { figma.ui.postMessage(msg) }

// ---------------------------------------------------------------------------
// Formatting helpers
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

// ---------------------------------------------------------------------------
// Source classification
//
// Classifies each AuditGroup's source after grouping using a precomputed
// set of local text style IDs. Called once per scan in the START_SCAN handler.
// ---------------------------------------------------------------------------

function classifyGroupSources(
  groups: AuditResult['groups'],
  localStyleIds: Set<string>
): void {
  for (const group of groups) {
    const props = group.descriptor as TypographyProperties
    const styleId = props.textStyleId ?? ''

    let source: SourceType
    if (!styleId) {
      source = 'Raw Values'
    } else if (localStyleIds.has(styleId)) {
      source = 'Local Text Style'
    } else {
      // Non-empty style ID not found in local styles — must be from a library.
      source = 'Library Text Style'
    }
    group.source = source
  }
}

// ---------------------------------------------------------------------------
// Detailed instrumentation report (unchanged from profiling sprint)
// ---------------------------------------------------------------------------

interface ProfileStage { name: string; ms: number }

function printDetailedReport(
  totalMs: number, serialMs: number, msgMs: number,
  scope: string, groupCount: number
): void {
  const ti = _traversalInstrument
  const ei = _extractionInstrument
  const gi = _grouperInstrument
  const t  = scanEngine.timings
  const N = ti.itemsExtracted
  const V = ti.nodesVisited

  const propTotalMs = ei.fontNameMs + ei.fontSizeMs + ei.lineHeightMs +
                      ei.letterSpacingMs + ei.textCaseMs + ei.textDecorationMs +
                      ei.textStyleIdMs  // Sprint 2
  const totalIpcAccesses = ei.fontNameAccesses + ei.fontSizeAccesses +
                           ei.lineHeightAccesses + ei.letterSpacingAccesses +
                           ei.textCaseAccesses + ei.textDecorationAccesses +
                           ei.textStyleIdAccesses  // Sprint 2
  const totalRangeCalls = ei.getRangeFontNameCalls + ei.getRangeFontSizeCalls +
                          ei.getRangeLineHeightCalls + ei.getRangeLetterSpacingCalls +
                          ei.getRangeTextCaseCalls + ei.getRangeTextDecorationCalls

  const W = 76
  const line = '═'.repeat(W)
  const mid  = '─'.repeat(W)

  function row(num: string, label: string, ms: number, items: number, itemLabel = ''): void {
    const d = fmtMs(ms).padStart(9)
    const p = pct(ms, totalMs)
    const n = items > 0 ? fmtN(items).padStart(9) : '        —'
    const r = items > 0 ? fmtRate(items, ms).padStart(12) : '           —'
    const lbl = (num + '  ' + label).padEnd(30)
    console.log(`  ${lbl}${d}   ${p}  ${n}  ${r}  ${itemLabel}`)
  }

  console.log('')
  console.log(`  ╔${line}╗`)
  console.log(`  ║  Refactor — Detailed Scan Instrumentation Report${' '.repeat(W - 50)}║`)
  console.log(`  ╠${line}╣`)
  console.log(`  ║  Scope: ${scope.padEnd(14)}  Nodes scanned: ${fmtN(ti.nodesMatched).padEnd(10)}  Total: ${fmtMs(totalMs)}${' '.repeat(Math.max(0, W - 56 - fmtMs(totalMs).length))}║`)
  console.log(`  ╠${line}╣`)
  console.log(`  ║  ${'#   Stage'.padEnd(30)}${'Duration'.padStart(9)}   ${'% Total'.padStart(7)}  ${'Items'.padStart(9)}  ${'Throughput'.padStart(12)}  ║`)
  console.log(`  ╠${mid}╣`)

  row('1',  'Document traversal',      ti.traversalMs,      V, 'nodes visited')
  row('2',  'Page lookup',             ti.pageLookupMs,     ti.pageLookupCount, 'lookups')
  row('3',  'Parent access',           ti.parentAccessMs,   ti.parentAccessCount, 'accesses')
  row('4',  'Text extraction total',   ti.extractionCallMs, N, 'nodes')

  console.log(`  ║  ${''.padEnd(30)}${'─'.repeat(44)}║`)
  console.log(`  ║  ${'    ├ fontName'.padEnd(30)}${fmtMs(ei.fontNameMs).padStart(9)}   ${pct(ei.fontNameMs, totalMs)}  ${fmtN(ei.fontNameAccesses).padStart(9)}  ${fmtRate(ei.fontNameAccesses, ei.fontNameMs).padStart(12)}  IPC/node║`)
  console.log(`  ║  ${'    ├ fontSize'.padEnd(30)}${fmtMs(ei.fontSizeMs).padStart(9)}   ${pct(ei.fontSizeMs, totalMs)}  ${fmtN(ei.fontSizeAccesses).padStart(9)}  ${fmtRate(ei.fontSizeAccesses, ei.fontSizeMs).padStart(12)}  IPC/node║`)
  console.log(`  ║  ${'    ├ lineHeight'.padEnd(30)}${fmtMs(ei.lineHeightMs).padStart(9)}   ${pct(ei.lineHeightMs, totalMs)}  ${fmtN(ei.lineHeightAccesses).padStart(9)}  ${fmtRate(ei.lineHeightAccesses, ei.lineHeightMs).padStart(12)}  IPC/node║`)
  console.log(`  ║  ${'    ├ letterSpacing'.padEnd(30)}${fmtMs(ei.letterSpacingMs).padStart(9)}   ${pct(ei.letterSpacingMs, totalMs)}  ${fmtN(ei.letterSpacingAccesses).padStart(9)}  ${fmtRate(ei.letterSpacingAccesses, ei.letterSpacingMs).padStart(12)}  IPC/node║`)
  console.log(`  ║  ${'    ├ textCase'.padEnd(30)}${fmtMs(ei.textCaseMs).padStart(9)}   ${pct(ei.textCaseMs, totalMs)}  ${fmtN(ei.textCaseAccesses).padStart(9)}  ${fmtRate(ei.textCaseAccesses, ei.textCaseMs).padStart(12)}  IPC/node║`)
  console.log(`  ║  ${'    ├ textDecoration'.padEnd(30)}${fmtMs(ei.textDecorationMs).padStart(9)}   ${pct(ei.textDecorationMs, totalMs)}  ${fmtN(ei.textDecorationAccesses).padStart(9)}  ${fmtRate(ei.textDecorationAccesses, ei.textDecorationMs).padStart(12)}  IPC/node║`)
  console.log(`  ║  ${'    └ textStyleId [S2]'.padEnd(30)}${fmtMs(ei.textStyleIdMs).padStart(9)}   ${pct(ei.textStyleIdMs, totalMs)}  ${fmtN(ei.textStyleIdAccesses).padStart(9)}  ${fmtRate(ei.textStyleIdAccesses, ei.textStyleIdMs).padStart(12)}  IPC/node║`)
  console.log(`  ║  ${'    Total IPC prop reads'.padEnd(30)}${fmtMs(propTotalMs).padStart(9)}   ${pct(propTotalMs, totalMs)}  ${fmtN(totalIpcAccesses).padStart(9)}  ${fmtRate(totalIpcAccesses, propTotalMs).padStart(12)}  calls   ║`)
  console.log(`  ╠${mid}╣`)

  row('5',  'Typography normalization', gi.normalizationMs,  gi.normalizationCount, 'items')
  row('6',  'Bucket insertion',         gi.bucketInsertMs,   gi.normalizationCount, 'items')
  row('7',  'Grouping total',           t.groupingMs,        N,          'items')
  row('8',  'Sorting',                  t.sortingMs,         groupCount, 'groups')
  row('9',  'Serialization',            serialMs,            N,          'items')
  row('10', 'UI messaging',             msgMs,               0,          '')
  console.log(`  ╠${mid}╣`)
  console.log(`  ║  ${'11  Total'.padEnd(30)}${fmtMs(totalMs).padStart(9)}   100.0%                            ║`)
  console.log(`  ╠${line}╣`)
  console.log(`  ║  Counters${' '.repeat(W - 9)}║`)
  console.log(`  ╠${mid}╣`)

  function counter(label: string, value: number, note = ''): void {
    const v = fmtN(value).padStart(12)
    console.log(`  ║  ${label.padEnd(36)}${v}${note ? `   ${note}` : ''}${' '.repeat(Math.max(0, W - 36 - 12 - (note ? note.length + 3 : 0) - 2))}║`)
  }

  counter('Nodes visited (DFS total):',         V)
  counter('Text nodes found:',                   ti.nodesMatched)
  counter('Items extracted (non-null):',         ti.itemsExtracted)
  counter('Page lookups (Map.get):',             ti.pageLookupCount)
  counter('Parent traversals (node.parent):',    ti.parentAccessCount)
  counter('fontName IPC accesses:',             ei.fontNameAccesses)
  counter('fontSize IPC accesses:',             ei.fontSizeAccesses)
  counter('lineHeight IPC accesses:',           ei.lineHeightAccesses)
  counter('letterSpacing IPC accesses:',        ei.letterSpacingAccesses)
  counter('textCase IPC accesses:',             ei.textCaseAccesses)
  counter('textDecoration IPC accesses:',       ei.textDecorationAccesses)
  counter('textStyleId IPC accesses [S2]:',     ei.textStyleIdAccesses)
  counter('getRangeFontName() calls:',           ei.getRangeFontNameCalls, totalRangeCalls === 0 ? '(0 mixed nodes)' : '')
  counter('getRangeFontSize() calls:',           ei.getRangeFontSizeCalls)
  counter('getRangeLineHeight() calls:',         ei.getRangeLineHeightCalls)
  counter('getRangeLetterSpacing() calls:',      ei.getRangeLetterSpacingCalls)
  counter('getRangeTextCase() calls:',           ei.getRangeTextCaseCalls)
  counter('getRangeTextDecoration() calls:',     ei.getRangeTextDecorationCalls)
  counter('sharedPluginData accesses:',          ei.sharedPluginDataAccesses, '(not implemented)')
  counter('Variable lookups:',                   ei.variableLookups, '(Sprint 3)')
  counter('Progress updates sent:',              ti.progressUpdateCount)

  console.log(`  ╠${mid}╣`)
  const avgTotalMs   = N > 0 ? (totalMs / N).toFixed(3) : '0'
  const avgExtractMs = N > 0 ? (ti.extractionCallMs / N).toFixed(3) : '0'
  const avgIpcMs     = totalIpcAccesses > 0 ? (propTotalMs / totalIpcAccesses).toFixed(3) : '0'
  console.log(`  ║  Avg per node: ${avgTotalMs}ms total  │  ${avgExtractMs}ms extraction  │  ${avgIpcMs}ms/IPC call${' '.repeat(Math.max(0, W - 62 - avgTotalMs.length - avgExtractMs.length - avgIpcMs.length))}║`)
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
      send({ type: 'SELECTION_INFO', payload: { count, hasSelection: count > 0 } })
      break
    }

    case 'SELECT_NODES': {
      const { locations } = msg.payload
      const outcome = await navigateToLocations(locations)
      if (outcome.ok) {
        const { selected, pageChanged, pageName, notFound } = outcome.result
        send({ type: 'NODES_SELECTED', payload: { count: selected, pageChanged, pageName, notFound } })
      } else {
        send({ type: 'NAVIGATION_ERROR', payload: { error: outcome.error.message, code: outcome.error.code } })
      }
      break
    }

    case 'START_SCAN': {
      const { moduleId, scope } = msg.payload
      const adapter = getAdapter(moduleId)
      if (!adapter) {
        send({ type: 'SCAN_ERROR', payload: { error: `No adapter registered for module "${moduleId}".` } })
        return
      }

      scanCancelled = false
      const tTotal = Date.now()

      // Sprint 2: Precompute local text style IDs once per scan.
      // Used after grouping to classify each group's source.
      let localStyleIds: Set<string>
      try {
        localStyleIds = new Set(figma.getLocalTextStyles().map((s) => s.id))
      } catch {
        localStyleIds = new Set()
      }

      resetExtractionInstrument()
      send({ type: 'SCAN_STARTED', payload: { moduleId, scope } })

      try {
        const { items, groups } = await scanEngine.run(
          adapter, scope, () => scanCancelled,
          (progress) => { if (scanCancelled) return; send({ type: 'SCAN_PROGRESS', payload: progress }) }
        )

        if (scanCancelled) { send({ type: 'SCAN_CANCELLED' }); return }

        // Sprint 2: Classify each group's source before building the result.
        classifyGroupSources(groups, localStyleIds)

        const scopeLabel = scope === 'selection' ? 'Selection' : scope === 'page' ? figma.currentPage.name : 'Entire File'

        const tSerial = Date.now()
        const result: AuditResult = {
          moduleId, scope, scopeLabel, totalItems: items.length,
          groups, scannedAt: tTotal, durationMs: Date.now() - tTotal,
        }
        const serialMs = Date.now() - tSerial

        const tMsg = Date.now()
        send({ type: 'SCAN_COMPLETE', payload: result })
        const msgMs = Date.now() - tMsg

        const totalMs = Date.now() - tTotal
        printDetailedReport(totalMs, serialMs, msgMs, scopeLabel, groups.length)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        send({ type: 'SCAN_ERROR', payload: { error: message } })
      }
      break
    }

    case 'CANCEL_SCAN': { scanCancelled = true; break }
    case 'RESIZE': { figma.ui.resize(msg.payload.width, msg.payload.height); break }
  }
}
