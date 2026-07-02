import {
  LayoutDashboard, Type, Layers, GitBranch, GitMerge, Play, FlaskConical, Settings,
} from 'lucide-react'
import { cn } from '../../lib/cn'
import { useUIStore, type AppPage } from '../../store/ui'
import { useAuditStore } from '../../store/audit'

interface NavItem {
  id: AppPage
  label: string
  icon: React.ElementType
  available: boolean
  requiresScan?: boolean
}

const WORKSPACE_NAV: NavItem[] = [
  { id: 'overview',   label: 'Overview',                icon: LayoutDashboard, available: true },
  { id: 'signatures', label: 'Typography Signatures',  icon: Type,            available: true, requiresScan: true },
  { id: 'sources',    label: 'Sources',                icon: Layers,          available: true, requiresScan: true },
  { id: 'planning',   label: 'Design System Planning', icon: GitBranch,       available: true, requiresScan: true },
]

const MIGRATION_NAV: NavItem[] = [
  { id: 'preview',    label: 'Migration Preview',  icon: GitMerge,    available: true, requiresScan: true },
  { id: 'simulation', label: 'Simulation',         icon: FlaskConical, available: true, requiresScan: true },
]

const DISABLED_NAV = [
  { label: 'Migration Execution', icon: Play },
]

export function Sidebar() {
  const { currentPage, navigate } = useUIStore()
  const { result } = useAuditStore()

  function handleNav(item: NavItem) {
    if (!item.available) return
    if (item.requiresScan && !result) { navigate('overview'); return }
    navigate(item.id)
  }

  function navButton(item: NavItem) {
    const Icon = item.icon
    const isActive = currentPage === item.id
    return (
      <button key={item.id} onClick={() => handleNav(item)} className={cn(
        'w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-left transition-colors duration-120',
        isActive ? 'bg-accent-subtle text-accent' : 'text-ink-2 hover:bg-surface-hover hover:text-ink'
      )}>
        <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={isActive ? 2 : 1.75} />
        <span className="text-sm flex-1 truncate">{item.label}</span>
      </button>
    )
  }

  return (
    <aside className="w-[192px] shrink-0 bg-surface-1 border-r border-border flex flex-col h-full">
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
        <p className="px-2 py-1.5 text-2xs font-semibold text-ink-disabled uppercase tracking-widest">Discovery & Planning</p>
        {WORKSPACE_NAV.map(navButton)}

        <div className="my-2 mx-2 border-t border-border-subtle" />
        <p className="px-2 py-1 text-2xs font-semibold text-ink-disabled uppercase tracking-widest">Migration</p>
        {MIGRATION_NAV.map(navButton)}
        {DISABLED_NAV.map(item => {
          const Icon = item.icon
          return (
            <div key={item.label} className="flex items-center gap-2.5 px-2 py-1.5 rounded text-ink-disabled cursor-not-allowed">
              <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
              <span className="text-sm flex-1 truncate">{item.label}</span>
              <span className="text-2xs shrink-0">Soon</span>
            </div>
          )
        })}
      </nav>

      <div className="shrink-0 border-t border-border-subtle p-2">
        <button onClick={() => navigate('settings')} className={cn(
          'w-full flex items-center gap-2.5 px-2 py-1.5 rounded transition-colors duration-120',
          currentPage === 'settings' ? 'bg-accent-subtle text-accent' : 'text-ink-disabled hover:text-ink-2 hover:bg-surface-hover'
        )}>
          <Settings className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span className="text-sm">Settings</span>
        </button>
      </div>
    </aside>
  )
}
