import { PageHeader } from '@/components/dashboard/page-header'
import { CalendarView } from '@/components/dashboard/calendar-view'
import { getDictionary, pageTitle } from '@/i18n/server'

export const generateMetadata = () => pageTitle('calendar')

export default async function Page() {
  const t = await getDictionary()
  return (
    <>
      <PageHeader title={t.calendar.title} description={t.calendar.subtitle} />
      <CalendarView />
    </>
  )
}
