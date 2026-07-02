interface PropertyRowProps {
  label: string
  value: string
}

export function PropertyRow({ label, value }: PropertyRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-border-subtle last:border-0">
      <span className="text-xs text-ink-3 shrink-0">{label}</span>
      <span className="text-xs font-medium text-ink text-right truncate">{value}</span>
    </div>
  )
}
