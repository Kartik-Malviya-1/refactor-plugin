import { create } from 'zustand'
import type { QueryCondition, QueryExpression } from '../../query/types'

let _nextId = 1

interface QueryState {
  expression: QueryExpression

  addCondition:    (cond: Omit<QueryCondition, 'id'>) => void
  removeCondition: (id: string) => void
  updateCondition: (id: string, update: Partial<Omit<QueryCondition, 'id'>>) => void
  toggleCondition: (id: string) => void
  clearAll:        () => void
}

export const useQueryStore = create<QueryState>((set) => ({
  expression: { conditions: [] },

  addCondition: (cond) =>
    set(s => ({
      expression: {
        ...s.expression,
        conditions: [...s.expression.conditions, { ...cond, id: `q${_nextId++}` }],
      },
    })),

  removeCondition: (id) =>
    set(s => ({
      expression: {
        ...s.expression,
        conditions: s.expression.conditions.filter(c => c.id !== id),
      },
    })),

  updateCondition: (id, update) =>
    set(s => ({
      expression: {
        ...s.expression,
        conditions: s.expression.conditions.map(c => c.id === id ? { ...c, ...update } : c),
      },
    })),

  toggleCondition: (id) =>
    set(s => ({
      expression: {
        ...s.expression,
        conditions: s.expression.conditions.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c),
      },
    })),

  clearAll: () => set({ expression: { conditions: [] } }),
}))
