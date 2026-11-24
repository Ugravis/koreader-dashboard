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
import { api, ApiError } from '@/lib/api'
import { useSession } from '@/lib/use-session'

const ERRORS: Record<string, string> = {
  invalid_code: 'This code does not exist. Check it on your e-reader.',
  code_used: 'This code has already been used.',
  expired: 'This code has expired. Start linking again on your e-reader.',
  rate_limited: 'Too many attempts. Wait a minute and try again.',
  invalid_request: 'Enter the 8-character code shown on your e-reader.',
}

/** Formats as `ABCD-EFGH` while typing. */
const formatCode = (value: string) => {
  const raw = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8)
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw
}

export function LinkDevice({ initialCode }: { initialCode: string }) {
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
        err instanceof ApiError ? (ERRORS[err.code] ?? err.message) : 'Network error, try again.',
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
          <CardTitle className="text-xl">Link a device</CardTitle>
          <CardDescription>
            Sign in first, then enter the code shown on your e-reader.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-3">
          <Link
            href={`/sign-in?redirect=${back}`}
            className={buttonVariants({ size: 'lg', className: 'w-full' })}
          >
            Sign in
          </Link>
          <Link
            href={`/sign-up?redirect=${back}`}
            className={buttonVariants({ size: 'lg', variant: 'outline', className: 'w-full' })}
          >
            Create an account
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
          <CardTitle className="text-xl">Device linked</CardTitle>
          <CardDescription>Your e-reader will finish linking in a few seconds.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href="/dashboard" className={buttonVariants({ size: 'lg', className: 'w-full' })}>
            Go to dashboard
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Link a device</CardTitle>
        <CardDescription>
          Enter the code shown on your e-reader, signed in as {session.user.email}.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="flex flex-col gap-2">
          <Label htmlFor="code">Pairing code</Label>
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
            {state === 'pending' ? 'Linking…' : 'Link device'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
