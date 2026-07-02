import { registerModule, getModule } from '../engine/registry'
import { typographyModule } from '../modules/typography/index'
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
      const startedAt = Date.now()

      send({ type: 'SCAN_STARTED', payload: { moduleId, scope } })

      try {
        const items = await module.scan(scope, (progress) => {
          if (scanCancelled) return
          send({ type: 'SCAN_PROGRESS', payload: progress })
        })

        if (scanCancelled) {
          send({ type: 'SCAN_CANCELLED' })
          return
        }

        const groups = module.group(items)

        const scopeLabel =
          scope === 'selection'
            ? 'Selection'
            : scope === 'page'
              ? figma.currentPage.name
              : 'Entire File'

        const result: AuditResult = {
          moduleId,
          scope,
          scopeLabel,
          totalItems: items.length,
          groups,
          scannedAt: startedAt,
          durationMs: Date.now() - startedAt,
        }

        send({ type: 'SCAN_COMPLETE', payload: result })
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
