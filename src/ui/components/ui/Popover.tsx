import { useState, useRef, useEffect, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface PopoverProps {
  trigger: ReactNode
  children: ReactNode
  className?: string
  side?: 'right' | 'bottom'
}

/**
 * Lightweight click-to-open popover. Platform component — reusable
 * across all workspaces and modules.
 */
export function Popover({ trigger, children, className, side = 'bottom' }: PopoverProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  const positionClass =
    side === 'right'
      ? 'left-full ml-2 top-0'
      : 'top-full mt-1.5 left-0'

  return (
    <div ref={ref} className="relative inline-flex" style={{ zIndex: open ? 50 : undefined }}>
      <div onClick={(e) => { e.stopPropagation(); setOpen(!open) }}>
        {trigger}
      </div>
      {open && (
        <div
          className={cn(
            'absolute z-50 w-60',
            positionClass,
            'bg-surface-1 border border-border rounded-lg shadow-dropdown p-3',
            className
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}
