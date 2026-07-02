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
          // Land on Overview after every successful scan.
          navigate('overview')
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

        case 'NODES_SELECTED': {
          const { count, pageChanged, pageName, notFound } = msg.payload
          const layerWord = count !== 1 ? 'layers' : 'layer'
          let message = `${count} ${layerWord} selected`
          if (pageChanged) message = `Navigated to “${pageName}” — ${message}`
          if (notFound > 0) {
            const missingWord = notFound !== 1 ? 'layers' : 'layer'
            message += ` (${notFound} ${missingWord} no longer exist)`
          }
          showToast(message, 'success')
          break
        }

        case 'NAVIGATION_ERROR':
          showToast(msg.payload.error, 'error')
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [setScanProgress, setScanResult, setScanError, setSelectionCount, showToast, navigate])
}
