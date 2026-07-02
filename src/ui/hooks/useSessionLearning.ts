import { create } from 'zustand'
import type { ConsolidationTarget } from '../../shared/migration'
import type { TypographyProperties } from '../../modules/typography/types'

/**
 * One accepted target recorded during the current planning session.
 * Not persisted — resets on page reload.
 */
export interface SessionAccepted {
  familyId: string
  target: ConsolidationTarget
  /** Dominant properties of the family this was accepted for. */
  dominantProps: TypographyProperties
  acceptedAt: number
}

interface SessionLearningStore {
  accepted: SessionAccepted[]

  /**
   * Record a new target acceptance.
   * Called whenever the designer accepts a suggestion or manually sets a target.
   */
  record: (entry: Omit<SessionAccepted, 'acceptedAt'>) => void

  /** Clear the session (e.g. after a new scan or reset). */
  clear: () => void
}

export const useSessionLearning = create<SessionLearningStore>((set) => ({
  accepted: [],

  record: (entry) =>
    set((s) => ({
      accepted: [...s.accepted, { ...entry, acceptedAt: Date.now() }],
    })),

  clear: () => set({ accepted: [] }),
}))
