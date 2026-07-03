import { create } from 'zustand'

/**
 * App pages after v0.2 information architecture redesign.
 * Top-level concepts (Sources, Preview, Simulation) are removed from nav.
 * Typography module has its own sub-pages.
 */
export type AppPage =
  | 'scan'
  | 'typography/overview'    // Typography module home — clickable summary cards
  | 'typography/raw'         // Raw Values detail (All + Clusters tabs)
  | 'typography/library'     // Library Styles detail
  | 'typography/local'       // Local Styles detail
  | 'typography/variables'   // Typography Variables detail
  | 'typography/signatures'  // Typography Signatures inspector (preserved)
  | 'settings'

export type ActiveModule = 'typography' | 'colors' | 'spacing' | 'radius' | 'effects' | 'variables-module'

interface UIState {
  currentPage: AppPage
  activeModule: ActiveModule

  // Typography Signatures inspector state (preserved from previous sprints)
  selectedGroupId: string | null
  inspectorOpen: boolean
  expandedGroupIds: Set<string>
  searchQuery: string
  sortField: 'count' | 'family' | 'size'
  sortDirection: 'asc' | 'desc'
  selectionCount: number

  toast: { message: string; type: 'success' | 'info' | 'error' } | null

  navigate: (page: AppPage) => void
  setModule: (m: ActiveModule) => void
  setSelectionCount: (n: number) => void
  selectGroup: (id: string | null) => void
  toggleGroupExpand: (id: string) => void
  setSearchQuery: (q: string) => void
  setSort: (field: UIState['sortField'], direction: UIState['sortDirection']) => void
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void
  clearToast: () => void
}

export const useUIStore = create<UIState>((set, get) => ({
  currentPage: 'typography/overview',
  activeModule: 'typography',
  selectedGroupId: null,
  inspectorOpen: false,
  expandedGroupIds: new Set(),
  searchQuery: '',
  sortField: 'count',
  sortDirection: 'desc',
  selectionCount: 0,
  toast: null,

  navigate: (page) => set({ currentPage: page }),

  setModule: (m) => {
    // Navigating to a module sets the relevant landing page
    if (m === 'typography') set({ activeModule: m, currentPage: 'typography/overview' })
    else set({ activeModule: m })  // coming soon modules don’t change page
  },

  setSelectionCount: (n) => set({ selectionCount: n }),
  selectGroup: (id) => set({ selectedGroupId: id, inspectorOpen: id !== null }),

  toggleGroupExpand: (id) => {
    const expanded = new Set(get().expandedGroupIds)
    if (expanded.has(id)) expanded.delete(id); else expanded.add(id)
    set({ expandedGroupIds: expanded })
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setSort: (field, direction) => set({ sortField: field, sortDirection: direction }),

  showToast: (message, type = 'info') => {
    set({ toast: { message, type } })
    window.setTimeout(() => set({ toast: null }), 3000)
  },

  clearToast: () => set({ toast: null }),
}))
