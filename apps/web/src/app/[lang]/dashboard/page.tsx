import { ContinueReading } from '@/components/dashboard/continue-reading'
import { GoalsCard } from '@/components/dashboard/goals'
import { Greeting } from '@/components/dashboard/greeting'
import { HighlightOfTheDay } from '@/components/dashboard/highlights-view'
import { FinishForecast, PausedBooks } from '@/components/dashboard/reading-forecast'
import { TopBooksCard, WeekActivity } from '@/components/dashboard/stats-view'
import { SummaryCards } from '@/components/dashboard/summary-cards'
import { pageTitle } from '@/i18n/server'

export const generateMetadata = () => pageTitle('overview')

export default function DashboardPage() {
  return (
    <>
      <Greeting />
      <SummaryCards />
      <ContinueReading />
      <div className="grid gap-6 lg:grid-cols-2">
        <GoalsCard />
        <HighlightOfTheDay />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <WeekActivity />
        <TopBooksCard />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <FinishForecast />
        <PausedBooks />
      </div>
    </>
  )
}
