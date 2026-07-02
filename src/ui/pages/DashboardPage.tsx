import { Type, Palette, Space, SquareDashedBottom, Sparkles, Braces, ArrowRight, CheckCircle } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { MODULE_CATALOG } from '../../engine/registry'
import { useUIStore } from '../store/ui'
import { useAuditStore } from '../store/audit'

const iconMap: Record<string, React.ElementType> = {
  Type, Palette, Space, SquareDashedBottom, Sparkles, Braces,
}

export function DashboardPage() {
  const { navigate, setActiveModule } = useUIStore()
  const { result } = useAuditStore()

  function handleModuleAction(moduleId: string) {
    setActiveModule(moduleId)
    if (result?.moduleId === moduleId) {
      navigate('audit')
    } else {
      navigate('scan')
    }
  }

  const typographyResult = result?.moduleId === 'typography' ? result : null

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-surface-0">
      <div className="px-6 pt-6 pb-4 border-b border-border-subtle bg-surface-1 shrink-0">
        <h1 className="text-lg font-semibold text-ink mb-0.5">What needs cleanup?</h1>
        <p className="text-xs text-ink-3 max-w-md leading-relaxed">
          Refactor scans your file for inconsistencies and helps you standardize them &#8212; one module at a time.
        </p>
      </div>

      <div className="flex-1 p-6 grid grid-cols-1 gap-4">
        {MODULE_CATALOG.filter((m) => m.available).map((mod) => {
          const Icon = iconMap[mod.icon] ?? Type
          const hasResult = typographyResult && mod.id === 'typography'
          return (
            <div key={mod.id} className="bg-surface-1 border border-border rounded-lg overflow-hidden">
              <div className="flex items-start gap-4 p-4">
                <div className="w-9 h-9 rounded-lg bg-accent-subtle flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-accent" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-ink">{mod.name}</p>
                    {hasResult && <CheckCircle className="w-3.5 h-3.5 text-success" />}
                  </div>
                  <p className="text-xs text-ink-3 mb-3 leading-relaxed">{mod.description}</p>
                  {hasResult ? (
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xl font-semibold text-ink tabular-nums">{typographyResult.groups.length}</span>
                        <span className="text-xs text-ink-3">unique styles</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xl font-semibold text-ink tabular-nums">{typographyResult.totalItems.toLocaleString()}</span>
                        <span className="text-xs text-ink-3">text layers</span>
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        <Button variant="ghost" size="sm" onClick={() => handleModuleAction(mod.id)}>
                          View Results<ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => navigate('scan')}>Re-scan</Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="primary" size="sm" onClick={() => handleModuleAction(mod.id)}>
                      Run Audit<ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        <div className="border border-dashed border-border rounded-lg p-4">
          <p className="text-xs font-semibold text-ink-disabled uppercase tracking-widest mb-3">Coming in future releases</p>
          <div className="grid grid-cols-2 gap-2">
            {MODULE_CATALOG.filter((m) => !m.available).map((mod) => {
              const Icon = iconMap[mod.icon] ?? Type
              return (
                <div key={mod.id} className="flex items-center gap-2.5 px-3 py-2 rounded bg-surface-0">
                  <Icon className="w-3.5 h-3.5 text-ink-disabled" strokeWidth={1.75} />
                  <p className="text-xs font-medium text-ink-disabled">{mod.name}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
