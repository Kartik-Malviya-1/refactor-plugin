import { Type, Palette, Space, SquareDashedBottom, Sparkles, Braces, Settings } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useUIStore, type ActiveModule } from '../../store/ui'

interface ModuleItem {
  id: ActiveModule
  label: string
  icon: React.ElementType
  available: boolean
}

const MODULES: ModuleItem[] = [
  { id: 'typography',        label: 'Typography',  icon: Type,                available: true },
  { id: 'colors',            label: 'Colors',       icon: Palette,             available: false },
  { id: 'spacing',           label: 'Spacing',      icon: Space,               available: false },
  { id: 'radius',            label: 'Radius',       icon: SquareDashedBottom,  available: false },
  { id: 'effects',           label: 'Effects',      icon: Sparkles,            available: false },
  { id: 'variables-module',  label: 'Variables',    icon: Braces,              available: false },
]

export function Sidebar() {
  const { activeModule, setModule, navigate } = useUIStore()

  return (
    <aside className="w-[180px] shrink-0 bg-surface-1 border-r border-border flex flex-col h-full">
      {/* Logo */}
      <div className="h-11 flex items-center px-4 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-ink rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold leading-none">R</span>
          </div>
          <span className="text-sm font-semibold text-ink tracking-tight">Refactor</span>
        </div>
        <span className="ml-auto text-2xs text-ink-disabled font-medium">v0.2</span>
      </div>

      {/* Module nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {MODULES.map((mod) => {
          const Icon = mod.icon
          const isActive = activeModule === mod.id
          return (
            <button
              key={mod.id}
              onClick={() => mod.available ? setModule(mod.id) : undefined}
              disabled={!mod.available}
              className={cn(
                'w-full flex items-center gap-2.5 px-2 py-2 rounded text-left transition-colors duration-120 mb-0.5',
                isActive && mod.available
                  ? 'bg-accent-subtle text-accent'
                  : mod.available
                    ? 'text-ink-2 hover:bg-surface-hover hover:text-ink'
                    : 'text-ink-disabled cursor-not-allowed'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2 : 1.75} />
              <span className="text-sm flex-1">{mod.label}</span>
              {!mod.available && (
                <span className="text-2xs text-ink-disabled">Soon</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Settings */}
      <div className="shrink-0 border-t border-border-subtle p-2">
        <button
          onClick={() => navigate('settings')}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded text-ink-disabled hover:text-ink-2 hover:bg-surface-hover transition-colors"
        >
          <Settings className="w-4 h-4" strokeWidth={1.75} />
          <span className="text-sm">Settings</span>
        </button>
      </div>
    </aside>
  )
}
