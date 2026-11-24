import { PageHeader } from '@/components/dashboard/page-header'
import { StatsView } from '@/components/dashboard/stats-view'
import { getDictionary, pageTitle } from '@/i18n/server'

export const generateMetadata = () => pageTitle('stats')

export default async function StatsPage() {
  const t = await getDictionary()
  return (
    <>
      <PageHeader title={t.stats.title} description={t.stats.subtitle} />
      <StatsView />
    </>
  )
}
