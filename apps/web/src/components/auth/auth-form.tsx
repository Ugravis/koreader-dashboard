'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
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

type Mode = 'sign-in' | 'sign-up'

export function AuthForm({ mode, redirectTo }: { mode: Mode; redirectTo: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const i18n = useI18n()
  const { href } = i18n
  const t = mode === 'sign-in' ? i18n.t.auth.signIn : i18n.t.auth.signUp
  const switchPath = mode === 'sign-in' ? '/sign-up' : '/sign-in'

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')
    setPending(true)
    setError(null)
    try {
      if (mode === 'sign-up') {
        await api.signUp({ name: String(form.get('name') ?? ''), email, password })
      } else {
        await api.signIn({ email, password })
      }
      router.push(href(redirectTo))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : i18n.t.common.networkError)
      setPending(false)
    }
  }

  const switchHref = `${href(switchPath)}?redirect=${encodeURIComponent(redirectTo)}`

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="flex flex-col gap-4">
          {mode === 'sign-up' && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{i18n.t.auth.name}</Label>
              <Input id="name" name="name" autoComplete="name" required />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{i18n.t.auth.email}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{i18n.t.auth.password}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              required
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter className="mt-4 flex flex-col gap-3">
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? i18n.t.common.pleaseWait : t.submit}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t.switchText}{' '}
            <Link href={switchHref} className="text-foreground underline underline-offset-4">
              {t.switchLabel}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
