import type { Metadata } from 'next'
import { Manrope, Sora } from 'next/font/google'
import './globals.css'
import { AppProvider } from '@/contexts/AppContext'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AgroMitra - AI Chatbot for Farmers',
  description: 'A comprehensive AI-powered agricultural chatbot for farmers and agricultural students',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${sora.variable}`}>
        <AppProvider>
          <div className="min-h-screen">{children}</div>
        </AppProvider>
      </body>
    </html>
  )
}
