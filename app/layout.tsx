import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PropControl — Controlá tus alquileres',
  description: 'La app argentina más completa para propietarios. Contratos escalonados, ajustes por IPC, expensas, ROI y alertas de vencimiento.',
  keywords: 'alquileres, propiedades, gestión inmobiliaria, IPC, contratos, expensas, Argentina',
  authors: [{ name: 'PropControl' }],
  icons: {
    icon: '/favicon.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'PropControl — Gestión de alquileres',
    description: 'Controlá tus alquileres. Maximizá tus resultados.',
    type: 'website',
    locale: 'es_AR',
    siteName: 'PropControl',
  },
  twitter: {
    card: 'summary',
    title: 'PropControl',
    description: 'Gestión de alquileres profesional',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
