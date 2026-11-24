import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export default function DashboardLayout({ children }: LayoutProps<'/[lang]/dashboard'>) {
  return <DashboardShell>{children}</DashboardShell>
}
