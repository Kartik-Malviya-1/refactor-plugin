import { useEffect } from 'react'
import type { PluginToUIMessage } from '../../shared/messages'
import { useAuditStore }    from '../store/audit'
import { useUIStore }       from '../store/ui'
import { usePlanningDataStore } from '../store/planningData'
import { useAssignmentStore }  from '../store/assignment'
import { useReviewStore }      from '../store/reviewStore'
import { usePreviewStore }     from '../store/previewStore'
import { sendToPlugin }        from './useSendMessage'

export const _usageExplorerListeners: Array<() => void> = []

export function usePluginMessages(): void {
  const { setScanProgress, setScanResult, setScanError } = useAuditStore()
  const { setSelectionCount, setCurrentPageId, showToast, navigate } = useUIStore()
  const { setData: setPlanningData, setLoading: setPlanningLoading } = usePlanningDataStore()

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const msg = event.data?.pluginMessage as PluginToUIMessage | undefined
      if (!msg?.type) return

      switch (msg.type) {
        case 'SCAN_PROGRESS': setScanProgress(msg.payload); break

        case 'SCAN_COMPLETE': {
          setScanResult(msg.payload)
          navigate('typography/overview')
          usePlanningDataStore.getState().clear()
          usePreviewStore.getState().clear()   // invalidate preview cache
          useReviewStore.getState().clear()    // review state is stale
          const validKeys = new Set<string>(msg.payload.groups.map((g: { key: string }) => g.key))
          const pruned = useAssignmentStore.getState().pruneOrphans(validKeys)
          if (pruned > 0) console.log(`[Refactor] Pruned ${pruned} orphan assignment(s)`)
          setPlanningLoading(true)
          sendToPlugin({ type: 'GET_PLANNING_DATA' })
          break
        }

        case 'SCAN_ERROR':
          setScanError(msg.payload.error)
          showToast(msg.payload.error, 'error')
          break

        case 'SCAN_CANCELLED': useAuditStore.getState().cancelScan(); break

        case 'SELECTION_INFO':
          setSelectionCount(msg.payload.count)
          if (msg.payload.currentPageId) setCurrentPageId(msg.payload.currentPageId)
          break

        case 'NODES_SELECTED': {
          const { count, pageChanged, pageName, notFound } = msg.payload
          const layerWord = count !== 1 ? 'layers' : 'layer'
          let message = `${count} ${layerWord} selected`
          if (pageChanged) message = `Navigated to "${pageName}" — ${message}`
          if (notFound > 0) message += ` (${notFound} no longer exist)`
          showToast(message, 'success')
          break
        }

        case 'NAVIGATION_ERROR': showToast(msg.payload.error, 'error'); break

        case 'PLANNING_DATA':
          setPlanningData(msg.payload.textStyles, msg.payload.variables)
          break

        case 'SHOW_USAGE_EXPLORER':
          for (const cb of _usageExplorerListeners) cb()
          break

        case 'REVIEW_NAVIGATED':
          if (!msg.payload.success) showToast('Could not navigate to frame', 'error')
          break

        // Sprint D — Preview Engine
        case 'PREVIEW_READY': {
          const { itemId, before, after } = msg.payload
          usePreviewStore.getState().setReady(itemId, before, after)
          break
        }
        case 'PREVIEW_ERROR': {
          const { itemId, error } = msg.payload
          usePreviewStore.getState().setError(itemId, error)
          break
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [setScanProgress, setScanResult, setScanError, setSelectionCount, setCurrentPageId, showToast, navigate, setPlanningData, setPlanningLoading])
}
