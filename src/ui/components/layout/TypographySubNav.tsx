import { cn } from '../../lib/cn'
import { useUIStore, type AppPage } from '../../store/ui'
import { useAuditStore } from '../../store/audit'
import { useAssignmentStore } from '../../store/assignment'

const TABS: { page: AppPage; label: string }[] = [
  { page: 'typography/overview',   label: 'Overview'        },
  { page: 'typography/raw',        label: 'Raw Values'      },
  { page: 'typography/library',    label: 'Library Styles'  },
  { page: 'typography/local',      label: 'Local Styles'    },
  { page: 'typography/variables',  label: 'Variables'       },
  { page: 'typography/review',     label: 'Review Changes'  },
]

/**
 * Horizontal sub-navigation shown below the header on all typography/* pages.
 *
 * The Review Changes tab shows a live badge with the number of planned
 * changes so the user always knows when there is something to review.
 */
export function TypographySubNav() {
  const { currentPage, navigate } = useUIStore()
  const { result } = useAuditStore()
  const assignmentCount = useAssignmentStore(s => Object.keys(s.assignments).length)

  return (
    <nav className="shrink-0 flex border-b border-border bg-surface-1">
      {TABS.map(({ page, label }) => {
        const isActive = currentPage === page ||
          (page === 'typography/overview' && currentPage === 'typography/signatures')
        const isDisabled = !result && page !== 'typography/overview'

        return (
          <button
            key={page}
            onClick={() => navigate(page)}
            disabled={isDisabled}
            className={cn(
              'relative flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              isActive
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-3 hover:text-ink disabled:text-ink-disabled disabled:cursor-not-allowed'
            )}
          >
            {label}
            {page === 'typography/review' && assignmentCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-accent text-white text-2xs font-semibold leading-none">
                {assignmentCount}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
