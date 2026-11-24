'use client'

import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { FormCardSkeleton } from '@/components/form-card-skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/i18n/provider'
import { api, ApiError } from '@/lib/api'
import { useSession } from '@/lib/use-session'

/** Formats as `ABCD-EFGH` while typing. */
const formatCode = (value: string) => {
  const raw = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8)
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw
}

export function LinkDevice({ initialCode }: { initialCode: string }) {
  const { t: i18n, href } = useI18n()
  const t = i18n.link
  const session = useSession()
  const [code, setCode] = useState(formatCode(initialCode))
  const [state, setState] = useState<'idle' | 'pending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('pending')
    setError(null)
    try {
      await api.confirmPairing(code)
      setState('done')
    } catch (err) {
      setError(
        err instanceof ApiError ? (t.errors[err.code] ?? err.message) : i18n.common.networkError,
      )
      setState('idle')
    }
  }

  if (session.status === 'loading') return <FormCardSkeleton />

  if (session.status === 'anonymous') {
    const back = encodeURIComponent(code ? `/link?code=${code.replace('-', '')}` : '/link')
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{t.title}</CardTitle>
          <CardDescription>{t.signInFirst}</CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-3">
          <Link
            href={`${href('/sign-in')}?redirect=${back}`}
            className={buttonVariants({ size: 'lg', className: 'w-full' })}
          >
            {t.signIn}
          </Link>
          <Link
            href={`${href('/sign-up')}?redirect=${back}`}
            className={buttonVariants({ size: 'lg', variant: 'outline', className: 'w-full' })}
          >
            {t.signUp}
          </Link>
        </CardFooter>
      </Card>
    )
  }

  if (state === 'done') {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <CheckCircle2 className="mx-auto size-10 text-primary" aria-hidden />
          <CardTitle className="text-xl">{t.doneTitle}</CardTitle>
          <CardDescription>{t.doneText}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Link
            href={href('/dashboard')}
            className={buttonVariants({ size: 'lg', className: 'w-full' })}
          >
            {t.goToDashboard}
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">{t.title}</CardTitle>
        <CardDescription>{t.enterCode(session.user.email)}</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="flex flex-col gap-2">
          <Label htmlFor="code">{t.codeLabel}</Label>
          <Input
            id="code"
            name="code"
            value={code}
            onChange={(e) => setCode(formatCode(e.target.value))}
            placeholder="ABCD-EFGH"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            className="h-11 text-center font-mono text-lg tracking-widest"
            aria-invalid={error ? true : undefined}
            required
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter className="mt-4">
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={state === 'pending' || code.replace('-', '').length !== 8}
          >
            {state === 'pending' ? t.pending : t.submit}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
