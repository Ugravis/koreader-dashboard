import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AuthForm } from '@/components/auth/auth-form'
import { FormCardSkeleton } from '@/components/form-card-skeleton'
import { safeRedirect } from '@/lib/redirect'

export const metadata: Metadata = { title: 'Sign in · KOReader Dashboard' }

export default function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  return (
    <Suspense fallback={<FormCardSkeleton />}>
      <Form searchParams={searchParams} />
    </Suspense>
  )
}

async function Form({ searchParams }: Pick<PageProps<'/sign-in'>, 'searchParams'>) {
  const { redirect } = await searchParams
  return <AuthForm mode="sign-in" redirectTo={safeRedirect(redirect)} />
}
