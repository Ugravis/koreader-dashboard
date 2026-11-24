import type { Metadata } from 'next'
import { DeviceList } from '@/components/dashboard/device-list'
import { PairingSteps } from '@/components/pairing-steps'

export const metadata: Metadata = { title: 'Devices · KOReader Dashboard' }

export default function DevicesPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Devices</h1>
      <DeviceList />
      <PairingSteps />
    </>
  )
}
