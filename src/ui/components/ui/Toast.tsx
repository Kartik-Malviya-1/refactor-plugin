import { CheckCircle, Info, XCircle, X } from 'lucide-react'
import { cn } from '../../lib/cn'

interface ToastProps {
  message: string
  type?: 'success' | 'info' | 'error'
  onDismiss: () => void
}

const config = {
  success: { icon: CheckCircle, className: 'bg-success text-white' },
  info: { icon: Info, className: 'bg-ink text-white' },
  error: { icon: XCircle, className: 'bg-danger text-white' },
}

export function Toast({ message, type = 'info', onDismiss }: ToastProps) {
  const { icon: Icon, className } = config[type]
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg shadow-elevated text-xs font-medium max-w-[280px]',
        className
      )}
      role="alert"
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1 leading-tight">{message}</span>
      <button onClick={onDismiss} className="shrink-0 opacity-70 hover:opacity-100 transition-opacity">
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
