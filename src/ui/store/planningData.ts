import { create } from 'zustand'
import type { AvailableTextStyle, AvailableTypographyVariable } from '../../shared/migration'

interface PlanningDataState {
  textStyles: AvailableTextStyle[]
  variables: AvailableTypographyVariable[]
  loaded: boolean
  loading: boolean

  setData:    (styles: AvailableTextStyle[], variables: AvailableTypographyVariable[]) => void
  setLoading: (b: boolean) => void
  clear:      () => void
}

export const usePlanningDataStore = create<PlanningDataState>((set) => ({
  textStyles: [],
  variables:  [],
  loaded:     false,
  loading:    false,

  setData: (textStyles, variables) => {
    console.log(`[Refactor] Planning data loaded: ${textStyles.length} styles, ${variables.length} variables`)
    set({ textStyles, variables, loaded: true, loading: false })
  },

  setLoading: (loading) => set({ loading }),

  clear: () => set({ textStyles: [], variables: [], loaded: false, loading: false }),
}))
