import { useMemo } from 'react'
import { Type, Search } from 'lucide-react'
import type { AuditGroup } from '../../shared/types'
import type { TypographyProperties } from '../../modules/typography/types'
import { SummaryCards } from '../components/audit/SummaryCards'
import { AuditTable } from '../components/audit/AuditTable'
import { TypographyInspector } from '../components/inspector/TypographyInspector'
import { SearchInput } from '../components/ui/SearchInput'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { InfoButton } from '../components/ui/InfoButton'
import { DEFINITIONS } from '../lib/definitions'
import { useAuditStore } from '../store/audit'
import { useUIStore } from '../store/ui'

export function AuditPage() {
  const { result } = useAuditStore()
  const { selectedGroupId, inspectorOpen, searchQuery, setSearchQuery, navigate } = useUIStore()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groups = (result?.groups ?? []) as unknown as AuditGroup<TypographyProperties>[]

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups
    const q = searchQuery.toLowerCase()
    return groups.filter(
      (g) =>
        g.descriptor.fontFamily.toLowerCase().includes(q) ||
        g.descriptor.fontStyle.toLowerCase().includes(q) ||
        String(g.descriptor.fontSize).includes(q) ||
        g.label.toLowerCase().includes(q)
    )
  }, [groups, searchQuery])

  const selectedGroup = selectedGroupId
    ? filteredGroups.find((g) => g.id === selectedGroupId) ?? null
    : null

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          icon={Type}
          title="No typography signatures"
          description="Run a scan to discover typography signatures in this document."
          action={<Button variant="primary" size="sm" onClick={() => navigate('scan')}>Run Scan</Button>}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
        {/* Toolbar */}
        <div className="shrink-0 border-b border-border bg-surface-1">
          <div className="px-4 pt-3 pb-2">
            <SummaryCards result={result} />
          </div>
          <div className="flex items-center gap-2 px-4 pb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-ink-2">Typography Signatures</span>
              <InfoButton definition={DEFINITIONS.typographySignature} side="bottom" />
            </div>
            <div className="flex-1" />
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by family, style, size…"
              className="max-w-xs"
            />
            {searchQuery && filteredGroups.length !== groups.length && (
              <span className="text-xs text-ink-3">
                {filteredGroups.length} of {groups.length}
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {filteredGroups.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matches"
              description={`No signatures match “${searchQuery}”.`}
            />
          ) : (
            <AuditTable groups={filteredGroups} />
          )}
        </div>
      </div>

      {/* Inspector */}
      {inspectorOpen && selectedGroup && (
        <TypographyInspector group={selectedGroup} />
      )}
    </div>
  )
}
