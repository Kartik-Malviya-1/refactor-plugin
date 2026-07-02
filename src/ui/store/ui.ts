import { create } from 'zustand'

export type AppPage = 'overview' | 'scan' | 'signatures' | 'sources' | 'planning' | 'preview' | 'settings'

interface UIState {
  currentPage: AppPage
  activeModuleId: string
  selectionCount: number
  selectedGroupId: string | null
  inspectorOpen: boolean
  expandedGroupIds: Set<string>
  searchQuery: string
  sortField: 'count' | 'family' | 'size'
  sortDirection: 'asc' | 'desc'
  toast: { message: string; type: 'success' | 'info' | 'error' } | null

  navigate: (page: AppPage) => void
  setActiveModule: (id: string) => void
  setSelectionCount: (n: number) => void
  selectGroup: (id: string | null) => void
  toggleGroupExpand: (id: string) => void
  setSearchQuery: (q: string) => void
  setSort: (field: UIState['sortField'], direction: UIState['sortDirection']) => void
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void
  clearToast: () => void
}

export const useUIStore = create<UIState>((set, get) => ({
  currentPage: 'overview',
  activeModuleId: 'typography',
  selectionCount: 0,
  selectedGroupId: null,
  inspectorOpen: false,
  expandedGroupIds: new Set(),
  searchQuery: '',
  sortField: 'count',
  sortDirection: 'desc',
  toast: null,

  navigate: (page) => set({ currentPage: page }),
  setActiveModule: (id) => set({ activeModuleId: id }),
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
