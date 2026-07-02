import { Search, X } from 'lucide-react'
import { cn } from '../../lib/cn'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }: SearchInputProps) {
  return (
    <div className={cn('relative flex items-center', className)}>
      <Search className="absolute left-2.5 w-3.5 h-3.5 text-ink-3 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full h-7 pl-8 pr-7 text-sm bg-surface-1 border border-border rounded',
          'placeholder:text-ink-disabled text-ink',
          'focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/20',
          'transition-colors duration-120'
        )}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 text-ink-3 hover:text-ink transition-colors"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
