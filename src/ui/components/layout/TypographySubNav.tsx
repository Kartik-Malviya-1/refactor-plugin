import { cn } from '../../lib/cn'
import { useUIStore, type AppPage } from '../../store/ui'
import { useAuditStore } from '../../store/audit'

const TABS: { page: AppPage; label: string }[] = [
  { page: 'typography/overview',   label: 'Overview' },
  { page: 'typography/raw',        label: 'Raw Values' },
  { page: 'typography/library',    label: 'Library Styles' },
  { page: 'typography/local',      label: 'Local Styles' },
  { page: 'typography/variables',  label: 'Variables' },
]

/**
 * Horizontal sub-navigation shown below the header on all typography/* pages.
 * Scoped to the Typography module — never shown for other modules.
 */
export function TypographySubNav() {
  const { currentPage, navigate } = useUIStore()
  const { result } = useAuditStore()

  return (
    <nav className="shrink-0 flex border-b border-border bg-surface-1">
      {TABS.map(({ page, label }) => {
        const isActive = currentPage === page ||
          // signatures inspector counts as being inside the overview
          (page === 'typography/overview' && currentPage === 'typography/signatures')

        return (
          <button
            key={page}
            onClick={() => navigate(page)}
            disabled={!result && page !== 'typography/overview'}
            className={cn(
              'px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              isActive
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-3 hover:text-ink disabled:text-ink-disabled disabled:cursor-not-allowed'
            )}
          >
            {label}
          </button>
        )
      })}
    </nav>
  )
}
