import { create } from 'zustand'
import type { AvailableTextStyle, AvailableTypographyVariable, EnhancedPlanningData } from '../../shared/migration'

interface PlanningDataState {
  textStyles: AvailableTextStyle[]
  variables: AvailableTypographyVariable[]
  enhanced: EnhancedPlanningData | null
  loaded: boolean
  loading: boolean

  setData:    (styles: AvailableTextStyle[], variables: AvailableTypographyVariable[]) => void
  setEnhancedData: (data: EnhancedPlanningData) => void
  setLoading: (b: boolean) => void
  clear:      () => void
}

export const usePlanningDataStore = create<PlanningDataState>((set) => ({
  textStyles: [],
  variables:  [],
  enhanced:   null,
  loaded:     false,
  loading:    false,

  setData: (textStyles, variables) => {
    console.log(`[Refactor] Planning data loaded: ${textStyles.length} styles, ${variables.length} variables`)
    set({ textStyles, variables, loaded: true, loading: false })
  },

  setEnhancedData: (enhanced) => {
    console.log(`[Refactor] Enhanced planning data: ${enhanced.textStyles.length} styles, ${enhanced.variables.length} vars, ${enhanced.collections.length} collections`)
    set({ enhanced })
  },

  setLoading: (loading) => set({ loading }),

  clear: () => set({ textStyles: [], variables: [], enhanced: null, loaded: false, loading: false }),
}))
