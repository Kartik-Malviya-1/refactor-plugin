import { useEffect } from 'react'
import { useAuditStore } from '../store/audit'
import { useUIStore } from '../store/ui'
import { usePlanningDataStore } from '../store/planningData'
import type { PluginToUIMessage } from '../../shared/messages'

export function usePluginMessages(): void {
  const { setScanProgress, setScanResult, setScanError } = useAuditStore()
  const { setSelectionCount } = useUIStore()
  const { setData, setEnhancedData } = usePlanningDataStore()

  useEffect(() => {
    function handler(event: MessageEvent): void {
      const msg = event.data?.pluginMessage as PluginToUIMessage | undefined
      if (!msg) return

      switch (msg.type) {
        case 'SCAN_PROGRESS':    setScanProgress(msg.payload); break
        case 'SCAN_COMPLETE':    setScanResult(msg.payload); break
        case 'SCAN_ERROR':       setScanError(msg.payload.error); break
        case 'SCAN_CANCELLED':   useAuditStore.getState().cancelScan(); break
        case 'SELECTION_INFO':   setSelectionCount(msg.payload.count); break
        case 'PLANNING_DATA':    setData(msg.payload.textStyles, msg.payload.variables); break
        case 'ENHANCED_PLANNING_DATA': setEnhancedData(msg.payload); break
        case 'NODES_SELECTED':   break
        case 'NAVIGATION_ERROR': console.warn('[Refactor] Navigation error:', msg.payload); break
        case 'SHOW_USAGE_EXPLORER': break
        case 'REVIEW_NAVIGATED': break
        case 'PREVIEW_READY':    break
        case 'PREVIEW_ERROR':    break
        case 'APPLY_PROGRESS':   break
        case 'APPLY_COMPLETE':   break
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [setScanProgress, setScanResult, setScanError, setSelectionCount, setData, setEnhancedData])
}
