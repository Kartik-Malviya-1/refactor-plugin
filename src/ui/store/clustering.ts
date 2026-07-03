import { create } from 'zustand'
import type { ClusteringConfig, ClusteringStrategy } from '../../clustering/types'
import { buildConfig } from '../../clustering/strategies'

interface ClusteringState {
  config: ClusteringConfig

  /** Switch to a preset strategy (or 'custom' to enable manual config). */
  setStrategy: (strategy: ClusteringStrategy) => void

  /** Update individual fields in Custom mode. */
  setCustomConfig: (partial: Partial<Omit<ClusteringConfig, 'strategy'>>) => void
}

export const useClusteringStore = create<ClusteringState>((set) => ({
  config: buildConfig('balanced'),

  setStrategy: (strategy) =>
    set((s) => ({
      config: buildConfig(strategy, strategy === 'custom' ? s.config : undefined),
    })),

  setCustomConfig: (partial) =>
    set((s) => ({
      config: { ...s.config, ...partial, strategy: 'custom' as ClusteringStrategy },
    })),
}))
