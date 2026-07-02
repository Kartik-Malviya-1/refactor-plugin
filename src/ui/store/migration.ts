import { create } from 'zustand'
import type {
  MigrationPlan,
  MigrationEntry,
  ConsolidationTarget,
  MigrationStrategy,
  PlanningStatus,
} from '../../shared/migration'
import type { CandidateFamily } from '../../similarity/types'

interface MigrationState {
  plan: MigrationPlan

  /** (Re)initialise the plan from the current Candidate Families list.
   *  Preserves existing entries for families that are still present. */
  initPlan: (families: CandidateFamily[]) => void

  /** Set the high-level migration strategy. */
  setStrategy: (strategy: MigrationStrategy) => void

  /** Confirm a consolidation target for a family (sets status → planned/skipped). */
  setTarget: (familyId: string, target: ConsolidationTarget) => void

  /** Clear the target and revert a family to in-progress. */
  clearTarget: (familyId: string) => void

  /** Manually set the planning status (e.g. in-progress while editing). */
  setStatus: (familyId: string, status: PlanningStatus) => void

  /** Toggle user approval on a planned entry. */
  setApproved: (familyId: string, approved: boolean) => void
}

function emptyPlan(): MigrationPlan {
  return { strategy: null, entries: {}, createdAt: Date.now(), updatedAt: Date.now() }
}

export const useMigrationStore = create<MigrationState>((set, get) => ({
  plan: emptyPlan(),

  initPlan: (families) => {
    const now = Date.now()
    const existing = get().plan.entries

    const entries: Record<string, MigrationEntry> = {}
    for (const family of families) {
      entries[family.id] = existing[family.id] ?? {
        familyId: family.id,
        status: 'unreviewed',
        target: null,
        userApproved: false,
        affectedSignatures: family.signatureCount,
        affectedLayers: family.totalLayers,
        affectedPages: family.pageIds.size,
      }
    }

    set((s) => ({
      plan: {
        ...s.plan,
        entries,
        updatedAt: now,
        createdAt: Object.keys(existing).length === 0 ? now : s.plan.createdAt,
      },
    }))
  },

  setStrategy: (strategy) =>
    set((s) => ({ plan: { ...s.plan, strategy, updatedAt: Date.now() } })),

  setTarget: (familyId, target) =>
    set((s) => {
      const entry = s.plan.entries[familyId]
      if (!entry) return s
      const status: PlanningStatus = target.type === 'skip' ? 'skipped' : 'planned'
      return {
        plan: {
          ...s.plan,
          updatedAt: Date.now(),
          entries: {
            ...s.plan.entries,
            [familyId]: { ...entry, target, status, userApproved: false },
          },
        },
      }
    }),

  clearTarget: (familyId) =>
    set((s) => {
      const entry = s.plan.entries[familyId]
      if (!entry) return s
      return {
        plan: {
          ...s.plan,
          updatedAt: Date.now(),
          entries: {
            ...s.plan.entries,
            [familyId]: { ...entry, target: null, status: 'in-progress', userApproved: false },
          },
        },
      }
    }),

  setStatus: (familyId, status) =>
    set((s) => {
      const entry = s.plan.entries[familyId]
      if (!entry) return s
      return {
        plan: {
          ...s.plan,
          updatedAt: Date.now(),
          entries: { ...s.plan.entries, [familyId]: { ...entry, status } },
        },
      }
    }),

  setApproved: (familyId, approved) =>
    set((s) => {
      const entry = s.plan.entries[familyId]
      if (!entry) return s
      return {
        plan: {
          ...s.plan,
          updatedAt: Date.now(),
          entries: { ...s.plan.entries, [familyId]: { ...entry, userApproved: approved } },
        },
      }
    }),
}))
