import { registerModule, registerAdapter, getAdapter } from '../engine/registry'
import { scanEngine } from '../engine/core'
import { typographyModule } from '../modules/typography/index'
import { typographyScannerAdapter } from '../modules/typography/adapter'
import type { UIToPluginMessage, PluginToUIMessage } from '../shared/messages'
import type { AuditResult } from '../shared/types'

// ---------------------------------------------------------------------------
// Module + Adapter registration
// Every new module requires two registrations:
//   registerModule()  — metadata + AuditModule interface (UI catalog)
//   registerAdapter() — ScannerAdapter for the Core Scan Engine
// ---------------------------------------------------------------------------
registerModule(typographyModule)
registerAdapter(typographyScannerAdapter)

figma.showUI(__html__, {
  width: 860,
  height: 620,
  themeColors: true,
})

let scanCancelled = false

function send(msg: PluginToUIMessage): void {
  figma.ui.postMessage(msg)
}

// ---------------------------------------------------------------------------
// Profiler output
// ---------------------------------------------------------------------------

function fmtMs(ms: number): string {
  if (ms >= 10000) return `${(ms / 1000).toFixed(1)}s `
  if (ms >= 1000)  return `${(ms / 1000).toFixed(2)}s`
  return `${ms}ms`
}

interface ProfileStage {
  name: string
  ms: number
}

function printScanProfile(stages: ProfileStage[], totalMs: number): void {
  const NAME_COL = 16
  const VAL_COL  = 9

  function row(name: string, ms: number): string {
    const dots = '.'.repeat(Math.max(1, NAME_COL - name.length + 1))
    const val  = fmtMs(ms).padStart(VAL_COL)
    const pct  = totalMs > 0
      ? `${((ms / totalMs) * 100).toFixed(1).padStart(5)}%`
      : '  0.0%'
    return `  ${name} ${dots} ${val}   ${pct}`
  }

  const divider = '  ' + '─'.repeat(NAME_COL + VAL_COL + 12)

  console.log('')
  console.log('  ┌─ Refactor Scan Profile ─────────────────────┐')
  for (const s of stages) {
    console.log(row(s.name, s.ms))
  }
  console.log(divider)
  console.log(row('Total', totalMs))
  console.log('  └' + '─'.repeat(NAME_COL + VAL_COL + 13) + '┘')
  console.log(`  Nodes scanned:   ${scanEngine.timings.nodeCount}`)
  console.log(`  Progress events: ${scanEngine.timings.progressEventCount}`)
  console.log('')
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

figma.ui.onmessage = async (rawMsg: unknown) => {
  const msg = rawMsg as UIToPluginMessage

  switch (msg.type) {
    case 'GET_SELECTION_INFO': {
      const count = figma.currentPage.selection.length
      send({
        type: 'SELECTION_INFO',
        payload: { count, hasSelection: count > 0 },
      })
      break
    }

    case 'SELECT_NODES': {
      const { nodeIds } = msg.payload
      const nodes: SceneNode[] = []
      for (const id of nodeIds) {
        const node = figma.currentPage.findOne((n: BaseNode) => n.id === id)
        if (node) nodes.push(node as SceneNode)
      }
      figma.currentPage.selection = nodes
      figma.viewport.scrollAndZoomIntoView(nodes)
      send({ type: 'NODES_SELECTED', payload: { count: nodes.length } })
      break
    }

    case 'START_SCAN': {
      const { moduleId, scope } = msg.payload

      // Look up the adapter for this module.
      // The engine only accepts adapters — never AuditModule directly.
      const adapter = getAdapter(moduleId)
      if (!adapter) {
        send({ type: 'SCAN_ERROR', payload: { error: `No adapter registered for module "${moduleId}".` } })
        return
      }

      scanCancelled = false
      const tTotal = Date.now()

      send({ type: 'SCAN_STARTED', payload: { moduleId, scope } })

      try {
        // The Core Scan Engine owns traversal, extraction, progress,
        // cancellation, and grouping. main.ts passes the adapter and
        // cancellation signal; the engine does the rest.
        const { items, groups } = await scanEngine.run(
          adapter,
          scope,
          () => scanCancelled,
          (progress) => {
            if (scanCancelled) return
            send({ type: 'SCAN_PROGRESS', payload: progress })
          }
        )

        if (scanCancelled) {
          send({ type: 'SCAN_CANCELLED' })
          return
        }

        const scopeLabel =
          scope === 'selection'
            ? 'Selection'
            : scope === 'page'
              ? figma.currentPage.name
              : 'Entire File'

        // ── Stage: Construction ──────────────────────────────────────────
        const tSerial = Date.now()
        const result: AuditResult = {
          moduleId,
          scope,
          scopeLabel,
          totalItems: items.length,
          groups,
          scannedAt: tTotal,
          durationMs: Date.now() - tTotal,
        }
        const serialMs = Date.now() - tSerial

        // ── Stage: Messaging ──────────────────────────────────────────────
        const tMsg = Date.now()
        send({ type: 'SCAN_COMPLETE', payload: result })
        const msgMs = Date.now() - tMsg

        const totalMs = Date.now() - tTotal

        // Read timing data from the engine (traversal + extraction +
        // grouping + sorting all measured internally by the engine).
        const t = scanEngine.timings
        printScanProfile(
          [
            { name: 'Traversal',     ms: t.traversalMs },
            { name: 'Extraction',    ms: t.extractionMs },
            { name: 'Normalization', ms: t.groupingMs },
            { name: 'Sorting',       ms: t.sortingMs },
            { name: 'Construction',  ms: serialMs },
            { name: 'Messaging',     ms: msgMs },
          ],
          totalMs
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        send({ type: 'SCAN_ERROR', payload: { error: message } })
      }
      break
    }

    case 'CANCEL_SCAN': {
      scanCancelled = true
      break
    }

    case 'RESIZE': {
      const { width, height } = msg.payload
      figma.ui.resize(width, height)
      break
    }
  }
}
