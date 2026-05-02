import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PropControl — Controlá tus alquileres',
  description: 'La forma más simple de controlar tus alquileres y maximizar tu rentabilidad.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
