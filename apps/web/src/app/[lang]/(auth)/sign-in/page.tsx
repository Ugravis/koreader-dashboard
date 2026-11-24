import { Suspense } from 'react'
import { AuthForm } from '@/components/auth/auth-form'
import { FormCardSkeleton } from '@/components/form-card-skeleton'
import { pageTitle } from '@/i18n/server'
import { safeRedirect } from '@/lib/redirect'

export const generateMetadata = () => pageTitle('signIn')

export default function SignInPage({ searchParams }: PageProps<'/[lang]/sign-in'>) {
  return (
    <Suspense fallback={<FormCardSkeleton />}>
      <Form searchParams={searchParams} />
    </Suspense>
  )
}

async function Form({ searchParams }: Pick<PageProps<'/[lang]/sign-in'>, 'searchParams'>) {
  const { redirect } = await searchParams
  return <AuthForm mode="sign-in" redirectTo={safeRedirect(redirect)} />
}
