import { create } from 'zustand'
import type { AuditResult, ScanProgress, ScanScope } from '../../shared/types'
import { sendToPlugin } from '../hooks/useSendMessage'

interface AuditState {
  isScanning: boolean
  scanProgress: ScanProgress | null
  scanError: string | null
  result: AuditResult | null
  lastModuleId: string
  lastScope: ScanScope | null

  startScan: (moduleId: string, scope: ScanScope) => void
  cancelScan: () => void
  setScanProgress: (progress: ScanProgress) => void
  setScanResult: (result: AuditResult) => void
  setScanError: (error: string) => void
  clearResult: () => void
}

export const useAuditStore = create<AuditState>((set) => ({
  isScanning: false,
  scanProgress: null,
  scanError: null,
  result: null,
  lastModuleId: 'typography',
  lastScope: null,

  startScan: (moduleId, scope) => {
    set({ isScanning: true, scanProgress: null, scanError: null, lastModuleId: moduleId, lastScope: scope })
    sendToPlugin({ type: 'START_SCAN', payload: { moduleId, scope } })
  },

  cancelScan: () => {
    sendToPlugin({ type: 'CANCEL_SCAN' })
    set({ isScanning: false, scanProgress: null })
  },

  setScanProgress: (progress) => set({ scanProgress: progress }),

  setScanResult: (result) =>
    set({ isScanning: false, scanProgress: null, scanError: null, result }),

  setScanError: (error) => set({ isScanning: false, scanProgress: null, scanError: error }),

  clearResult: () => set({ result: null, scanError: null }),
}))
