import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AuthForm } from '@/components/auth/auth-form'
import { FormCardSkeleton } from '@/components/form-card-skeleton'
import { safeRedirect } from '@/lib/redirect'

export const metadata: Metadata = { title: 'Sign up · KOReader Dashboard' }

export default function SignUpPage({ searchParams }: PageProps<'/sign-up'>) {
  return (
    <Suspense fallback={<FormCardSkeleton />}>
      <Form searchParams={searchParams} />
    </Suspense>
  )
}

async function Form({ searchParams }: Pick<PageProps<'/sign-up'>, 'searchParams'>) {
  const { redirect } = await searchParams
  return <AuthForm mode="sign-up" redirectTo={safeRedirect(redirect)} />
}
