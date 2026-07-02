import { Info } from 'lucide-react'
import { Popover } from './Popover'
import type { TermDefinition } from '../../lib/definitions'

interface InfoButtonProps {
  definition: TermDefinition
  side?: 'right' | 'bottom'
}

/**
 * ⓘ icon that opens a definition popover on click.
 * Platform component — add beside any major domain concept.
 */
export function InfoButton({ definition, side }: InfoButtonProps) {
  return (
    <Popover
      side={side}
      trigger={
        <button
          className="p-0.5 rounded text-ink-disabled hover:text-ink-3 transition-colors"
          title={`What is ${definition.term}?`}
        >
          <Info className="w-3 h-3" />
        </button>
      }
    >
      <div className="space-y-2">
        <p className="text-xs font-semibold text-ink">{definition.term}</p>
        <p className="text-xs text-ink-3 leading-relaxed">{definition.description}</p>
        {definition.properties && definition.properties.length > 0 && (
          <ul className="space-y-0.5">
            {definition.properties.map((p, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-ink-3">
                <span className="shrink-0 mt-1 w-1 h-1 rounded-full bg-border-strong" />
                {p}
              </li>
            ))}
          </ul>
        )}
        {definition.note && (
          <p className="text-xs text-ink-disabled italic leading-relaxed border-t border-border-subtle pt-2">
            {definition.note}
          </p>
        )}
      </div>
    </Popover>
  )
}
