import { useState } from 'react'
import { Settings } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useClusteringStore } from '../../store/clustering'
import { STRATEGY_LABELS, STRATEGY_DESCRIPTIONS } from '../../../clustering/strategies'
import type { ClusteringStrategy } from '../../../clustering/types'

const STRATEGIES: ClusteringStrategy[] = ['conservative', 'balanced', 'aggressive', 'custom']

export function StrategySelector() {
  const { config, setStrategy, setCustomConfig } = useClusteringStore()
  const [customOpen, setCustomOpen] = useState(false)

  function handleStrategy(s: ClusteringStrategy) {
    setStrategy(s)
    if (s === 'custom') setCustomOpen(true)
  }

  return (
    <div className="shrink-0 border-b border-border bg-surface-1">
      {/* Strategy tabs */}
      <div className="flex items-center px-4 py-2 gap-1">
        <span className="text-2xs text-ink-disabled font-medium uppercase tracking-widest mr-2 shrink-0">Clustering:</span>
        {STRATEGIES.map(s => (
          <button
            key={s}
            onClick={() => handleStrategy(s)}
            title={STRATEGY_DESCRIPTIONS[s]}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium transition-colors',
              config.strategy === s
                ? 'bg-accent text-accent-fg'
                : 'text-ink-3 hover:text-ink hover:bg-surface-hover'
            )}
          >
            {STRATEGY_LABELS[s]}
          </button>
        ))}
        {config.strategy === 'custom' && (
          <button
            onClick={() => setCustomOpen(!customOpen)}
            className={cn('ml-auto p-1 rounded transition-colors', customOpen ? 'text-accent' : 'text-ink-3 hover:text-ink')}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Custom config panel */}
      {config.strategy === 'custom' && customOpen && (
        <div className="px-4 pb-3 space-y-3 border-t border-border-subtle pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-2xs text-ink-3 font-medium block mb-1">
                Merge Threshold: {config.mergeThreshold}%
              </label>
              <input type="range" min={40} max={98} step={5} value={config.mergeThreshold}
                onChange={e => setCustomConfig({ mergeThreshold: Number(e.target.value) })}
                className="w-full h-1.5 accent-accent" />
              <div className="flex justify-between text-2xs text-ink-disabled mt-0.5">
                <span>Aggressive</span><span>Conservative</span>
              </div>
            </div>
            <div>
              <label className="text-2xs text-ink-3 font-medium block mb-1">
                Outlier Threshold: {config.outlierThreshold}%
              </label>
              <input type="range" min={20} max={80} step={5} value={config.outlierThreshold}
                onChange={e => setCustomConfig({ outlierThreshold: Number(e.target.value) })}
                className="w-full h-1.5 accent-accent" />
            </div>
          </div>
          <div>
            <p className="text-2xs text-ink-3 font-medium mb-2">Property Weights</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {(Object.entries(config.weights) as [string, number][]).map(([prop, w]) => (
                <div key={prop} className="flex items-center gap-2">
                  <span className="text-2xs text-ink-3 w-24 capitalize shrink-0">{prop.replace(/([A-Z])/g, ' $1')}</span>
                  <input type="number" min={0} max={20} value={w}
                    onChange={e => setCustomConfig({ weights: { ...config.weights, [prop]: Number(e.target.value) } })}
                    className="w-12 h-5 px-1 text-xs bg-surface-0 border border-border rounded text-center" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
