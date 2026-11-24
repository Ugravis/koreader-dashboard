import type { Metadata } from 'next'
import { Suspense } from 'react'
import { BookDetail, BookDetailSkeleton } from '@/components/dashboard/book-detail'

export const metadata: Metadata = { title: 'Book · KOReader Dashboard' }

export default function BookPage({ params }: PageProps<'/dashboard/books/[id]'>) {
  return (
    <Suspense fallback={<BookDetailSkeleton />}>
      <Detail params={params} />
    </Suspense>
  )
}

async function Detail({ params }: Pick<PageProps<'/dashboard/books/[id]'>, 'params'>) {
  const { id } = await params
  return <BookDetail id={id} />
}
