import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent-hover disabled:bg-accent/40 disabled:cursor-not-allowed',
  secondary:
    'bg-surface-1 text-ink border border-border hover:bg-surface-hover active:bg-surface-active disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'bg-transparent text-ink-2 hover:bg-surface-hover hover:text-ink active:bg-surface-active disabled:opacity-50 disabled:cursor-not-allowed',
  danger:
    'bg-danger text-white hover:bg-danger/90 active:bg-danger/80 disabled:opacity-50 disabled:cursor-not-allowed',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-6 px-2.5 text-xs gap-1.5',
  md: 'h-7 px-3 text-sm gap-2',
  lg: 'h-8 px-4 text-base gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded transition-colors duration-120 select-none whitespace-nowrap',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : null}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
