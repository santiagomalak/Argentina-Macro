import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Argentina Macro Dashboard',
  description: 'Dólar blue, MEP, CCL, inflación y riesgo país en tiempo real. Tipos de cambio, brecha cambiaria, plazo fijo y análisis macroeconómico de Argentina.',
  keywords: ['dólar blue', 'dólar hoy', 'inflación argentina', 'riesgo país', 'MEP', 'CCL', 'brecha cambiaria', 'plazo fijo'],
  openGraph: {
    title: 'Argentina Macro Dashboard',
    description: 'Dólar blue, MEP, CCL, inflación y riesgo país en tiempo real.',
    url: 'https://argentina-macro.vercel.app',
    siteName: 'Argentina Macro',
    locale: 'es_AR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Argentina Macro Dashboard',
    description: 'Dólar blue, MEP, CCL, inflación y riesgo país en tiempo real.',
  },
  metadataBase: new URL('https://argentina-macro.vercel.app'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className} style={{ background: '#0d0d10', margin: 0 }}>
        {children}
      </body>
    </html>
  )
}
