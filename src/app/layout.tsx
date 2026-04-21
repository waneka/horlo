import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'
import { Header } from '@/components/layout/Header'
import { HeaderSkeleton } from '@/components/layout/HeaderSkeleton'

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

// Blocking inline script that runs before React hydration and before first
// paint. Reads horlo-theme cookie; if 'dark' → add `dark` class; if 'light'
// → ensure absent; if missing / 'system' → fall back to prefers-color-scheme.
// Canonical shadcn/next-themes pattern for zero-FOUC SSR theming under
// Next.js 16 Cache Components (which forbids cookies() in the layout body).
const themeInitScript = `(function(){try{var m=document.cookie.match(/(?:^|; )horlo-theme=(light|dark)/);var t=m?m[1]:null;var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var r=document.documentElement;if(d)r.classList.add('dark');else r.classList.remove('dark');r.style.colorScheme=d?'dark':'light';}catch(e){}})();`

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background">
        <ThemeProvider>
          <Suspense fallback={<HeaderSkeleton />}>
            <Header />
          </Suspense>
          <Suspense fallback={null}>
            <main className="flex-1">{children}</main>
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  )
}
