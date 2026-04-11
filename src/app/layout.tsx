import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'
import { Header } from '@/components/layout/Header'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const instrumentSerif = Instrument_Serif({
  variable: '--font-serif',
  subsets: ['latin'],
  weight: '400',
})

export const metadata: Metadata = {
  title: 'Horlo - Watch Collection',
  description: 'A taste-aware decision engine for watch collectors',
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies()
  const stored = cookieStore.get('horlo-theme')?.value
  const themeClass = stored === 'dark' ? 'dark' : stored === 'light' ? 'light' : ''

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} ${themeClass} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background">
        <ThemeProvider initialTheme={stored === 'dark' || stored === 'light' ? stored : 'system'}>
          <Header />
          <main className="flex-1">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  )
}
