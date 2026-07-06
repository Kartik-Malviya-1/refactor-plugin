import { create } from 'zustand'

type PreviewStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface PreviewEntry {
  status: PreviewStatus
  before: string   // data:image/png;base64,...
  after:  string
  error?: string
}

interface PreviewState {
  previews: Record<string, PreviewEntry>  // itemId → entry

  setLoading: (itemId: string) => void
  setReady:   (itemId: string, before: string, after: string) => void
  setError:   (itemId: string, error: string) => void
  clear:      () => void

  get: (itemId: string) => PreviewEntry | undefined
}

export const usePreviewStore = create<PreviewState>((set, get) => ({
  previews: {},

  setLoading: (itemId) =>
    set(s => ({ previews: { ...s.previews, [itemId]: { status: 'loading', before: '', after: '' } } })),

  setReady: (itemId, before, after) =>
    set(s => ({ previews: { ...s.previews, [itemId]: { status: 'ready', before: `data:image/png;base64,${before}`, after: `data:image/png;base64,${after}` } } })),

  setError: (itemId, error) =>
    set(s => ({ previews: { ...s.previews, [itemId]: { status: 'error', before: '', after: '', error } } })),

  clear: () => set({ previews: {} }),

  get: (itemId) => get().previews[itemId],
}))
