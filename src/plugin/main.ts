import { registerModule, getModule } from '../engine/registry'
import { typographyModule } from '../modules/typography/index'
import { _scanTimings } from '../modules/typography/scanner'
import { _groupTimings } from '../modules/typography/index'
import type { UIToPluginMessage, PluginToUIMessage } from '../shared/messages'
import type { AuditResult } from '../shared/types'

registerModule(typographyModule)

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
  console.log(`  Nodes scanned: ${_scanTimings.nodeCount}`)

  if (_scanTimings.benchSampleSize > 0) {
    const n         = _scanTimings.nodeCount
    const oldEstMs  = Math.round(_scanTimings.benchBaselineMsPerNode * n)
    const newActMs  = _scanTimings.extractionMs
    const pctBetter = oldEstMs > 0
      ? Math.round((1 - newActMs / oldEstMs) * 100)
      : 0

    const sampleNote = `(${_scanTimings.benchSampleSize}-node sample × ${n} nodes)`

    console.log('')
    console.log('  ┌─ Extraction optimisation: before → after ─────────┐')
    console.log(`  │  Before (double-access)  ${fmtMs(oldEstMs).padStart(8)}  estimated ${sampleNote}`)
    console.log(`  │  After  (cached access)  ${fmtMs(newActMs).padStart(8)}  measured`)
    console.log(`  │  Improvement             ~${pctBetter}% faster`)
    console.log('  └' + '─'.repeat(NAME_COL + VAL_COL + 30) + '┘')
  }

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
      const module = getModule(moduleId)

      if (!module) {
        send({ type: 'SCAN_ERROR', payload: { error: `Module "${moduleId}" is not registered.` } })
        return
      }

      scanCancelled = false
      const tTotal = Date.now()

      send({ type: 'SCAN_STARTED', payload: { moduleId, scope } })

      try {
        // ── Stage: Scan (traversal + extraction) ──────────────────────────
        const items = await module.scan(scope, (progress) => {
          if (scanCancelled) return
          send({ type: 'SCAN_PROGRESS', payload: progress })
        })

        if (scanCancelled) {
          send({ type: 'SCAN_CANCELLED' })
          return
        }

        // ── Stage: Group (normalization + sorting) ────────────────────────
        const groups = module.group(items)

        const scopeLabel =
          scope === 'selection'
            ? 'Selection'
            : scope === 'page'
              ? figma.currentPage.name
              : 'Entire File'

        // ── Stage: Construction ───────────────────────────────────────────
        // Measure only the cost of assembling the AuditResult object.
        // Previously this stage ran void JSON.stringify(result) to measure
        // serialisation cost, which caused the entire result to be serialised
        // twice — once here and once inside postMessage's structured clone.
        // Removed. msgMs below now captures the real structured-clone cost.
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

        // ── Stage: Messaging (includes structured-clone cost) ─────────────
        const tMsg = Date.now()
        send({ type: 'SCAN_COMPLETE', payload: result })
        const msgMs = Date.now() - tMsg

        const totalMs = Date.now() - tTotal

        printScanProfile(
          [
            { name: 'Traversal',     ms: _scanTimings.traversalMs },
            { name: 'Extraction',    ms: _scanTimings.extractionMs },
            { name: 'Normalization', ms: _groupTimings.normalizationMs },
            { name: 'Sorting',       ms: _groupTimings.sortingMs },
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
