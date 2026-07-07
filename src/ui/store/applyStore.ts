import { create } from 'zustand'
import type { ApplyPhase, ApplyProgress, MigrationReport } from '../../shared/apply-types'

interface ApplyState {
  phase: ApplyPhase; progress: ApplyProgress | null; report: MigrationReport | null
  startApply:  () => void
  setProgress: (p: ApplyProgress) => void
  setComplete: (r: MigrationReport) => void
  reset:       () => void
}

export const useApplyStore = create<ApplyState>((set) => ({
  phase: 'idle', progress: null, report: null,
  startApply:  () => set({ phase: 'applying', progress: null, report: null }),
  setProgress: (p) => set({ progress: p, phase: p.phase }),
  setComplete: (r) => set({ report: r, phase: 'complete', progress: null }),
  reset:       () => set({ phase: 'idle', progress: null, report: null }),
}))
