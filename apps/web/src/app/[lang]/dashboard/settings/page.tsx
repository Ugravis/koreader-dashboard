import { PageHeader } from '@/components/dashboard/page-header'
import { SettingsView } from '@/components/dashboard/settings-view'
import { getDictionary, pageTitle } from '@/i18n/server'

export const generateMetadata = () => pageTitle('settings')

export default async function SettingsPage() {
  const t = await getDictionary()
  return (
    <>
      <PageHeader title={t.settings.title} />
      <SettingsView />
    </>
  )
}
