import type { Metadata } from 'next'
import { Suspense } from 'react'
import { FormCardSkeleton } from '@/components/form-card-skeleton'
import { LinkDevice } from '@/components/link/link-device'

export const metadata: Metadata = { title: 'Link a device · KOReader Dashboard' }

export default function LinkPage({ searchParams }: PageProps<'/link'>) {
  return (
    <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
      <Suspense fallback={<FormCardSkeleton />}>
        <Link searchParams={searchParams} />
      </Suspense>
    </main>
  )
}

async function Link({ searchParams }: Pick<PageProps<'/link'>, 'searchParams'>) {
  const { code } = await searchParams
  return <LinkDevice initialCode={typeof code === 'string' ? code : ''} />
}
