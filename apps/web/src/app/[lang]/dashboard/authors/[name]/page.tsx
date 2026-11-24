import { Suspense } from 'react'
import { AuthorDetail } from '@/components/dashboard/authors-view'
import { Skeleton } from '@/components/ui/skeleton'
import { pageTitle } from '@/i18n/server'

export const generateMetadata = () => pageTitle('author')

export default function AuthorPage({ params }: PageProps<'/[lang]/dashboard/authors/[name]'>) {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
      <Detail params={params} />
    </Suspense>
  )
}

async function Detail({ params }: Pick<PageProps<'/[lang]/dashboard/authors/[name]'>, 'params'>) {
  const { name } = await params
  return <AuthorDetail name={decodeURIComponent(name)} />
}
