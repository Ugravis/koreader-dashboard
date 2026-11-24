import type { Metadata } from 'next'
import { SummaryCards } from '@/components/dashboard/summary-cards'

export const metadata: Metadata = { title: 'Dashboard · KOReader Dashboard' }

export default function DashboardPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
      <SummaryCards />
    </>
  )
}
