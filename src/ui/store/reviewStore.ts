import { create } from 'zustand'
import type { ReviewItem, ReviewStatus } from '../../shared/review'

interface ReviewState {
  items:         ReviewItem[]
  currentItemId: string | null
  statuses:      Record<string, ReviewStatus>

  setItems:       (items: ReviewItem[]) => void
  setCurrentItem: (id: string | null) => void
  markStatus:     (id: string, status: ReviewStatus) => void
  clear:          () => void
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  items:         [],
  currentItemId: null,
  statuses:      {},

  setItems: (items) => set({ items }),

  setCurrentItem: (id) => {
    set({ currentItemId: id })
    // Auto-mark as reviewed on first open
    if (id) {
      const { statuses } = get()
      if (!statuses[id] || statuses[id] === 'unread') {
        set(s => ({ statuses: { ...s.statuses, [id]: 'reviewed' } }))
      }
    }
  },

  markStatus: (id, status) =>
    set(s => ({ statuses: { ...s.statuses, [id]: status } })),

  clear: () => set({ items: [], currentItemId: null, statuses: {} }),
}))
