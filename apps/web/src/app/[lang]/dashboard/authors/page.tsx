import { PageHeader } from '@/components/dashboard/page-header'
import { AuthorsView } from '@/components/dashboard/authors-view'
import { getDictionary, pageTitle } from '@/i18n/server'

export const generateMetadata = () => pageTitle('authors')

export default async function Page() {
  const t = await getDictionary()
  return (
    <>
      <PageHeader title={t.authors.title} description={t.authors.subtitle} />
      <AuthorsView />
    </>
  )
}
