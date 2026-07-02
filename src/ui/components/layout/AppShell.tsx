import { type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { Toast } from '../ui/Toast'
import { useUIStore } from '../../store/ui'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { toast, clearToast } = useUIStore()
  return (
    <div className="flex h-full overflow-hidden bg-surface-0">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Header />
        <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
      </div>
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <Toast message={toast.message} type={toast.type} onDismiss={clearToast} />
        </div>
      )}
    </div>
  )
}
