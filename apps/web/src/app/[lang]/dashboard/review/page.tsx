import { PageHeader } from '@/components/dashboard/page-header'
import { YearReview } from '@/components/dashboard/year-review'
import { getDictionary, pageTitle } from '@/i18n/server'

export const generateMetadata = () => pageTitle('review')

export default async function Page() {
  const t = await getDictionary()
  return (
    <>
      <PageHeader title={t.review.title} description={t.review.subtitle} />
      <YearReview />
    </>
  )
}
