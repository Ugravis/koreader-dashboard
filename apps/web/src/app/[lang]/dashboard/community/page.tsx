import { Users } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { getDictionary, pageTitle } from '@/i18n/server'

export const generateMetadata = () => pageTitle('community')

export default async function CommunityPage() {
  const t = await getDictionary()
  return (
    <>
      <PageHeader title={t.community.title} />
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Users className="size-6 text-muted-foreground" aria-hidden />
          </span>
          <p className="font-medium">{t.community.soon}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t.community.text}</p>
        </CardContent>
      </Card>
    </>
  )
}
