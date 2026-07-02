import { useEffect } from 'react'
import type { PluginToUIMessage } from '../../shared/messages'
import { useAuditStore } from '../store/audit'
import { useUIStore } from '../store/ui'

export function usePluginMessages(): void {
  const { setScanProgress, setScanResult, setScanError } = useAuditStore()
  const { setSelectionCount, showToast, navigate } = useUIStore()

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const msg = event.data?.pluginMessage as PluginToUIMessage | undefined
      if (!msg?.type) return

      switch (msg.type) {
        case 'SCAN_PROGRESS':
          setScanProgress(msg.payload)
          break
        case 'SCAN_COMPLETE':
          setScanResult(msg.payload)
          navigate('audit')
          break
        case 'SCAN_ERROR':
          setScanError(msg.payload.error)
          showToast(msg.payload.error, 'error')
          break
        case 'SCAN_CANCELLED':
          useAuditStore.getState().cancelScan()
          break
        case 'SELECTION_INFO':
          setSelectionCount(msg.payload.count)
          break
        case 'NODES_SELECTED':
          showToast(`${msg.payload.count} layer${msg.payload.count !== 1 ? 's' : ''} selected`, 'success')
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [setScanProgress, setScanResult, setScanError, setSelectionCount, showToast, navigate])
}
