import { type ReactNode } from 'react'
import { cn } from '../../lib/cn'

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'muted'

interface BadgeProps {
  variant?: BadgeVariant
  className?: string
  children: ReactNode
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-hover text-ink-2 border border-border',
  accent: 'bg-accent-subtle text-accent border border-accent/20',
  success: 'bg-success-subtle text-success border border-success/20',
  warning: 'bg-warning-subtle text-warning border border-warning/20',
  danger: 'bg-danger-subtle text-danger border border-danger/20',
  muted: 'bg-surface-0 text-ink-3 border border-border-subtle',
}

export function Badge({ variant = 'default', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium tabular-nums',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
