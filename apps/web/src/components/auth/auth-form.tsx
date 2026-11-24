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
import { api, ApiError } from '@/lib/api'

type Mode = 'sign-in' | 'sign-up'

const copy = {
  'sign-in': {
    title: 'Sign in',
    description: 'Access your reading dashboard.',
    submit: 'Sign in',
    switchText: 'No account yet?',
    switchLabel: 'Sign up',
    switchHref: '/sign-up',
  },
  'sign-up': {
    title: 'Create an account',
    description: 'Sync your KOReader statistics.',
    submit: 'Create account',
    switchText: 'Already have an account?',
    switchLabel: 'Sign in',
    switchHref: '/sign-in',
  },
} as const

export function AuthForm({ mode, redirectTo }: { mode: Mode; redirectTo: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const t = copy[mode]

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
      router.push(redirectTo)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Network error, try again.')
      setPending(false)
    }
  }

  const switchHref = `${t.switchHref}?redirect=${encodeURIComponent(redirectTo)}`

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
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" autoComplete="name" required />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
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
            {pending ? 'Please wait…' : t.submit}
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
