import {
  Type, Palette, Space, SquareDashedBottom, Sparkles, Braces, Settings,
} from 'lucide-react'
import { cn } from '../../lib/cn'
import { MODULE_CATALOG } from '../../../engine/registry'
import { useUIStore } from '../../store/ui'
import { useAuditStore } from '../../store/audit'

const iconMap: Record<string, React.ElementType> = {
  Type, Palette, Space, SquareDashedBottom, Sparkles, Braces,
}

export function Sidebar() {
  const { activeModuleId, setActiveModule, navigate } = useUIStore()
  const { result } = useAuditStore()

  function handleModuleClick(id: string, available: boolean) {
    if (!available) return
    setActiveModule(id)
    if (result?.moduleId === id) {
      navigate('audit')
    } else {
      navigate('dashboard')
    }
  }

  return (
    <aside className="w-[184px] shrink-0 bg-surface-1 border-r border-border flex flex-col h-full">
      <div className="h-11 flex items-center px-4 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-ink rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold leading-none">R</span>
          </div>
          <span className="text-sm font-semibold text-ink tracking-tight">Refactor</span>
        </div>
        <span className="ml-auto text-2xs text-ink-disabled font-medium">v0.1</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-2">
        <p className="px-2 py-1.5 text-2xs font-semibold text-ink-disabled uppercase tracking-widest">
          Modules
        </p>
        {MODULE_CATALOG.map((mod) => {
          const Icon = iconMap[mod.icon] ?? Type
          const isActive = activeModuleId === mod.id
          const isAvailable = mod.available
          return (
            <button
              key={mod.id}
              onClick={() => handleModuleClick(mod.id, isAvailable)}
              disabled={!isAvailable}
              className={cn(
                'w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-left transition-colors duration-120',
                isActive && isAvailable
                  ? 'bg-accent-subtle text-accent'
                  : isAvailable
                    ? 'text-ink-2 hover:bg-surface-hover hover:text-ink'
                    : 'text-ink-disabled cursor-not-allowed'
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={isActive ? 2 : 1.75} />
              <span className="text-sm flex-1 truncate">{mod.name}</span>
              {mod.comingSoon && (
                <span className="text-2xs text-ink-disabled shrink-0">Soon</span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="shrink-0 border-t border-border-subtle p-2">
        <button
          disabled
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-ink-disabled cursor-not-allowed"
        >
          <Settings className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span className="text-sm">Settings</span>
        </button>
      </div>
    </aside>
  )
}
