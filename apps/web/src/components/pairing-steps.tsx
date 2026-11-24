'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/i18n/provider'
import { API_URL } from '@/lib/api'

const code = 'rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8rem] break-words'

/** How to link a KOReader e-reader, shown on /link and in the settings. */
export function PairingSteps({ className }: { className?: string }) {
  const { pairing: t } = useI18n().t
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
          <li>
            {t.step1.before} <span className={code}>koreader-dashboard-ulysse.koplugin</span>{' '}
            {t.step1.middle} <span className={code}>koreader/plugins/</span>
            {t.step1.after}
          </li>
          <li>
            {t.step2.before} <strong>{t.step2.menu}</strong> {t.step2.after}{' '}
            <span className={code}>{API_URL}</span>.
          </li>
          <li>
            {t.step3.before} <strong>{t.step3.link}</strong> {t.step3.or}{' '}
            <strong>{t.step3.linkNow}</strong> {t.step3.after}
          </li>
          <li>{t.step4}</li>
        </ol>
      </CardContent>
    </Card>
  )
}
