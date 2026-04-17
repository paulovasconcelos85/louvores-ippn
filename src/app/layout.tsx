import type { Metadata } from 'next'
import './globals.css'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { LocaleProvider } from '@/i18n/provider'
import { getMessages } from '@/i18n/messages'
import { getRequestLocale } from '@/i18n/server'
import { createTranslator } from '@/i18n/translator'
import { getHtmlLang } from '@/i18n/config'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  const messages = getMessages(locale)
  const t = createTranslator(messages)

  return {
    title: t('app.name'),
    description: t('app.description'),
    icons: {
      icon: 'https://ippontanegra.wordpress.com/wp-content/uploads/2025/06/ippn-logo-1-edited-e1751169919732.png',
    },
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getRequestLocale()
  const messages = getMessages(locale)

  return (
    <html lang={getHtmlLang(locale)}>
      <body>
        <LocaleProvider initialLocale={locale} messages={messages}>
          {children}
          <LanguageSwitcher />
        </LocaleProvider>
      </body>
    </html>
  )
}
