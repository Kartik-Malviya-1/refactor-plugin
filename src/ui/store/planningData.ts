import { create } from 'zustand'
import type { AvailableTextStyle, AvailableTypographyVariable } from '../../shared/migration'

interface PlanningDataState {
  textStyles: AvailableTextStyle[]
  variables: AvailableTypographyVariable[]
  loaded: boolean

  setData: (styles: AvailableTextStyle[], variables: AvailableTypographyVariable[]) => void
  clear: () => void
}

export const usePlanningDataStore = create<PlanningDataState>((set) => ({
  textStyles: [],
  variables: [],
  loaded: false,

  setData: (textStyles, variables) => set({ textStyles, variables, loaded: true }),
  clear: () => set({ textStyles: [], variables: [], loaded: false }),
}))
