import { useEffect } from 'react'
import type { PluginToUIMessage } from '../../shared/messages'
import { useAuditStore } from '../store/audit'
import { useUIStore } from '../store/ui'
import { usePlanningDataStore } from '../store/planningData'
import { useAssignmentStore } from '../store/assignment'
import { sendToPlugin } from './useSendMessage'

// Shared listener registry — TypographyInspector subscribes here to be
// notified when the plugin sends SHOW_USAGE_EXPLORER (multi-page selection).
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

          // Invalidate planning data — _styleCache is now warm with fresh data.
          // The style picker will re-fetch when next opened.
          usePlanningDataStore.getState().clear()

          // Prune assignments for signatures that no longer exist after the scan.
          // This keeps the assignment store consistent with the new scan result.
          // Note: correctness depends on group IDs being stable across scans of
          // the same document (deterministic from normalization key + source).
          const validIds = new Set<string>(msg.payload.groups.map((g: { id: string }) => g.id))
          const pruned = useAssignmentStore.getState().pruneOrphans(validIds)
          if (pruned > 0) console.log(`[Refactor] Pruned ${pruned} orphan assignment(s) after scan`)

          // Performance: pre-fetch planning data immediately while cache is warm.
          // This pre-warms the style picker so AssignmentPanel opens instantly
          // instead of showing a loading spinner for the common post-scan path.
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
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [setScanProgress, setScanResult, setScanError, setSelectionCount, setCurrentPageId, showToast, navigate, setPlanningData, setPlanningLoading])
}
