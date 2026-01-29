import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'OIKOS Hub - IPPN',
  description: 'Sistema de gerenciamento de louvores da Igreja Presbiteriana Ponta Negra',
  icons: {
    icon: 'https://ippontanegra.wordpress.com/wp-content/uploads/2025/06/ippn-logo-1-edited-e1751169919732.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}

