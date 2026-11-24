import type { Metadata } from 'next'
import { Suspense } from 'react'
import { FormCardSkeleton } from '@/components/form-card-skeleton'
import { LinkDevice } from '@/components/link/link-device'
import { PairingSteps } from '@/components/pairing-steps'

export const metadata: Metadata = { title: 'Link a device · KOReader Dashboard' }

export default function LinkPage({ searchParams }: PageProps<'/link'>) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-4 sm:p-6">
      <Suspense fallback={<FormCardSkeleton />}>
        <Link searchParams={searchParams} />
      </Suspense>
      <PairingSteps className="w-full max-w-sm" />
    </main>
  )
}

async function Link({ searchParams }: Pick<PageProps<'/link'>, 'searchParams'>) {
  const { code } = await searchParams
  return <LinkDevice initialCode={typeof code === 'string' ? code : ''} />
}
