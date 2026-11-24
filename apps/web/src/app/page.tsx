import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">KOReader Dashboard</h1>
      <p className="max-w-md text-muted-foreground">
        Your KOReader reading statistics, synced and visualized.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/sign-up" className={buttonVariants({ size: 'lg' })}>
          Get started
        </Link>
        <Link href="/sign-in" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
          Sign in
        </Link>
      </div>
    </main>
  )
}
