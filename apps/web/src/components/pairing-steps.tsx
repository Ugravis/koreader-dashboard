import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { API_URL } from '@/lib/api'

const code = 'rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8rem] break-words'

/** How to link a KOReader e-reader, shown on /link and /dashboard/devices. */
export function PairingSteps({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>How to link your e-reader</CardTitle>
        <CardDescription>About two minutes, once per e-reader.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
          <li>
            Plug the e-reader in over USB and copy the{' '}
            <span className={code}>koreader-dashboard-ulysse.koplugin</span> folder into{' '}
            <span className={code}>koreader/plugins/</span>. Restart KOReader.
          </li>
          <li>
            On the e-reader, open <strong>Tools › KOReader Dashboard › Server URL</strong> and enter{' '}
            <span className={code}>{API_URL}</span>.
          </li>
          <li>
            Tap <strong>Link this device</strong> (or <strong>Link now</strong> on the welcome
            panel). A code and a QR code appear.
          </li>
          <li>
            Scan the QR code with your phone, or open this page and enter the code. Your reading
            statistics sync right after.
          </li>
        </ol>
      </CardContent>
    </Card>
  )
}
