import { create } from 'zustand'
import type { AssignedTarget } from '../../clustering/types'

interface AssignmentState {
  /**
   * Per-signature assignment map.
   * Key = AuditGroup.id (Typography Signature ID).
   * Users never see the internal mapping structure — they only see targets.
   */
  assignments: Record<string, AssignedTarget>

  /** Assign one or more signatures to the same target. */
  assign: (signatureIds: string[], target: AssignedTarget) => void

  /** Remove assignments from specific signatures. */
  clear: (signatureIds: string[]) => void

  /** Remove all assignments for signatures belonging to a cluster. */
  clearCluster: (clusterMemberIds: string[]) => void

  /** Remove every assignment. */
  clearAll: () => void

  /** Convenience accessor for a single signature. */
  getAssignment: (signatureId: string) => AssignedTarget | undefined
}

export const useAssignmentStore = create<AssignmentState>((set, get) => ({
  assignments: {},

  assign: (signatureIds, target) =>
    set((s) => {
      const next = { ...s.assignments }
      for (const id of signatureIds) next[id] = target
      return { assignments: next }
    }),

  clear: (signatureIds) =>
    set((s) => {
      const next = { ...s.assignments }
      for (const id of signatureIds) delete next[id]
      return { assignments: next }
    }),

  clearCluster: (clusterMemberIds) =>
    set((s) => {
      const next = { ...s.assignments }
      for (const id of clusterMemberIds) delete next[id]
      return { assignments: next }
    }),

  clearAll: () => set({ assignments: {} }),

  getAssignment: (signatureId) => get().assignments[signatureId],
}))
