import { create } from 'zustand'
import type { AssignedTarget } from '../../clustering/types'

// ---------------------------------------------------------------------------
// Assignment Store
//
// Maps typography signature IDs to their assigned consolidation targets.
// One signature → one mapping at most (Record keying guarantees this).
// No duplicate mappings are possible.
//
// Orphan mappings (signatures that no longer exist after a new scan) are
// pruned by pruneOrphans(), called from the SCAN_COMPLETE handler in
// usePluginMessage.ts.
//
// Working set stability: assignments are keyed by signature ID, not by
// working-set position or visible index. Changing the query filter only
// changes which signatures are VISIBLE — it never touches this store.
// ---------------------------------------------------------------------------

interface AssignmentState {
  /** One entry per assigned signature. Record for Zustand serializability. */
  assignments: Record<string, AssignedTarget>

  /**
   * Set the same target for one or more signature IDs.
   * Overwrites any existing mapping for each ID (one signature → one mapping).
   */
  assign: (signatureIds: string[], target: AssignedTarget) => void

  /** Remove assignments for the given signature IDs. */
  remove: (signatureIds: string[]) => void

  /**
   * Delete assignments for signature IDs that are NOT in validIds.
   * Call this after every scan with the new scan's group ID set.
   * Returns the number of orphan mappings that were removed.
   */
  pruneOrphans: (validIds: Set<string>) => number

  /** Remove all assignments. */
  clear: () => void

  /** Get the assignment for one signature, or undefined if unassigned. */
  getAssignment: (signatureId: string) => AssignedTarget | undefined

  /** Total number of active mappings. */
  getAssignedCount: () => number
}

export const useAssignmentStore = create<AssignmentState>((set, get) => ({
  assignments: {},

  assign: (signatureIds, target) =>
    set(state => {
      const next = { ...state.assignments }
      for (const id of signatureIds) next[id] = target
      return { assignments: next }
    }),

  remove: (signatureIds) =>
    set(state => {
      const next = { ...state.assignments }
      for (const id of signatureIds) delete next[id]
      return { assignments: next }
    }),

  pruneOrphans: (validIds) => {
    const stale = Object.keys(get().assignments).filter(id => !validIds.has(id))
    if (stale.length > 0) {
      set(state => {
        const next = { ...state.assignments }
        for (const id of stale) delete next[id]
        return { assignments: next }
      })
    }
    return stale.length
  },

  clear: () => set({ assignments: {} }),

  getAssignment:    (id)  => get().assignments[id],
  getAssignedCount: ()    => Object.keys(get().assignments).length,
}))
