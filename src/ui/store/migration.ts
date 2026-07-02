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

  initPlan: (families: CandidateFamily[]) => void
  setStrategy: (strategy: MigrationStrategy | null) => void
  setTarget: (
    familyId: string,
    target: ConsolidationTarget,
    source?: 'suggestion' | 'manual'
  ) => void
  clearTarget: (familyId: string) => void
  setStatus: (familyId: string, status: PlanningStatus) => void
  setApproved: (familyId: string, approved: boolean) => void
  resetAll: () => void
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
        // Sprint 5: initial status is always needs-review.
        // The planning page upgrades to suggestions-available via useEffect.
        status: 'needs-review',
        target: null,
        acceptedViaSuggestion: false,
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

  setTarget: (familyId, target, source = 'manual') =>
    set((s) => {
      const entry = s.plan.entries[familyId]
      if (!entry) return s

      const wasPlannedViaSuggestion = entry.acceptedViaSuggestion
      const isManualEdit = source === 'manual' && wasPlannedViaSuggestion
      const status: PlanningStatus =
        target.type === 'skip' ? 'skipped'
        : isManualEdit ? 'modified'
        : 'planned'

      return {
        plan: {
          ...s.plan,
          updatedAt: Date.now(),
          entries: {
            ...s.plan.entries,
            [familyId]: {
              ...entry,
              target,
              status,
              acceptedViaSuggestion: source === 'suggestion',
              userApproved: false,
            },
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
            [familyId]: {
              ...entry,
              target: null,
              status: 'needs-review',
              acceptedViaSuggestion: false,
              userApproved: false,
            },
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

  resetAll: () =>
    set((s) => ({
      plan: {
        ...s.plan,
        updatedAt: Date.now(),
        entries: Object.fromEntries(
          Object.entries(s.plan.entries).map(([id, e]) => [
            id,
            { ...e, target: null, status: 'needs-review' as PlanningStatus, acceptedViaSuggestion: false, userApproved: false },
          ])
        ),
      },
    })),
}))
