import { Suspense } from 'react'
import { BookDetail, BookDetailSkeleton } from '@/components/dashboard/book-detail'
import { pageTitle } from '@/i18n/server'

export const generateMetadata = () => pageTitle('book')

export default function BookPage({ params }: PageProps<'/[lang]/dashboard/books/[id]'>) {
  return (
    <Suspense fallback={<BookDetailSkeleton />}>
      <Detail params={params} />
    </Suspense>
  )
}

async function Detail({ params }: Pick<PageProps<'/[lang]/dashboard/books/[id]'>, 'params'>) {
  const { id } = await params
  return <BookDetail id={id} />
}
