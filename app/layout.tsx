import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Argentina Macro Dashboard',
  description: 'Dólar blue, MEP, CCL, inflación y riesgo país en tiempo real. Datos macroeconómicos de Argentina actualizados al minuto.',
  openGraph: {
    title: 'Argentina Macro Dashboard',
    description: 'Tipos de cambio, inflación y riesgo país en tiempo real.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className} style={{ background: '#080810', margin: 0 }}>
        {children}
      </body>
    </html>
  )
}
