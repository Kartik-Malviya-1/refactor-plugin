import { create } from 'zustand'

export type AppPage =
  | 'scan'
  | 'typography/overview'
  | 'typography/raw'
  | 'typography/library'
  | 'typography/local'
  | 'typography/variables'
  | 'typography/review'       // Review Changes — final review before Apply
  | 'typography/signatures'
  | 'settings'

export type ActiveModule = 'typography' | 'colors' | 'spacing' | 'radius' | 'effects' | 'variables-module'

interface UIState {
  currentPage: AppPage
  activeModule: ActiveModule
  selectedGroupId: string | null
  inspectorOpen: boolean
  expandedGroupIds: Set<string>
  searchQuery: string
  sortField: 'count' | 'family' | 'size'
  sortDirection: 'asc' | 'desc'
  selectionCount: number
  currentPageId: string
  toast: { message: string; type: 'success' | 'info' | 'error' } | null

  navigate: (page: AppPage) => void
  setModule: (m: ActiveModule) => void
  setSelectionCount: (n: number) => void
  setCurrentPageId: (id: string) => void
  selectGroup: (id: string | null) => void
  toggleGroupExpand: (id: string) => void
  setSearchQuery: (q: string) => void
  setSort: (field: UIState['sortField'], direction: UIState['sortDirection']) => void
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void
  clearToast: () => void
}

export const useUIStore = create<UIState>((set, get) => ({
  currentPage:      'typography/overview',
  activeModule:     'typography',
  selectedGroupId:  null,
  inspectorOpen:    false,
  expandedGroupIds: new Set(),
  searchQuery:      '',
  sortField:        'count',
  sortDirection:    'desc',
  selectionCount:   0,
  currentPageId:    '',
  toast:            null,

  navigate:          (page) => set({ currentPage: page }),
  setModule:         (m) => {
    if (m === 'typography') set({ activeModule: m, currentPage: 'typography/overview' })
    else set({ activeModule: m })
  },
  setSelectionCount: (n)    => set({ selectionCount: n }),
  setCurrentPageId:  (id)   => set({ currentPageId: id }),
  selectGroup:       (id)   => set({ selectedGroupId: id, inspectorOpen: id !== null }),

  toggleGroupExpand: (id) => {
    const expanded = new Set(get().expandedGroupIds)
    if (expanded.has(id)) expanded.delete(id); else expanded.add(id)
    set({ expandedGroupIds: expanded })
  },

  setSearchQuery: (q)             => set({ searchQuery: q }),
  setSort:        (field, direction) => set({ sortField: field, sortDirection: direction }),

  showToast: (message, type = 'info') => {
    set({ toast: { message, type } })
    window.setTimeout(() => set({ toast: null }), 3000)
  },
  clearToast: () => set({ toast: null }),
}))
