import { PageHeader } from '@/components/dashboard/page-header'
import { HighlightsView } from '@/components/dashboard/highlights-view'
import { getDictionary, pageTitle } from '@/i18n/server'

export const generateMetadata = () => pageTitle('highlights')

export default async function Page() {
  const t = await getDictionary()
  return (
    <>
      <PageHeader title={t.highlights.title} description={t.highlights.subtitle} />
      <HighlightsView />
    </>
  )
}
