import { Suspense } from 'react'
import { AuthForm } from '@/components/auth/auth-form'
import { FormCardSkeleton } from '@/components/form-card-skeleton'
import { pageTitle } from '@/i18n/server'
import { safeRedirect } from '@/lib/redirect'

export const generateMetadata = () => pageTitle('signUp')

export default function SignUpPage({ searchParams }: PageProps<'/[lang]/sign-up'>) {
  return (
    <Suspense fallback={<FormCardSkeleton />}>
      <Form searchParams={searchParams} />
    </Suspense>
  )
}

async function Form({ searchParams }: Pick<PageProps<'/[lang]/sign-up'>, 'searchParams'>) {
  const { redirect } = await searchParams
  return <AuthForm mode="sign-up" redirectTo={safeRedirect(redirect)} />
}
