import { BookLibrary } from '@/components/dashboard/book-library'
import { PageHeader } from '@/components/dashboard/page-header'
import { getDictionary, pageTitle } from '@/i18n/server'

export const generateMetadata = () => pageTitle('books')

export default async function BooksPage() {
  const t = await getDictionary()
  return (
    <>
      <PageHeader title={t.books.title} />
      <BookLibrary />
    </>
  )
}
