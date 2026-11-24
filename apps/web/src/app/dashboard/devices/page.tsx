import type { Metadata } from 'next'
import Link from 'next/link'
import { DeviceList } from '@/components/dashboard/device-list'
import { buttonVariants } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Devices · KOReader Dashboard' }

export default function DevicesPage() {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Devices</h1>
        <Link href="/link" className={buttonVariants({ variant: 'outline' })}>
          Link a device
        </Link>
      </div>
      <DeviceList />
    </>
  )
}
