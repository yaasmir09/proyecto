import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gestión de Cobranza Inteligente',
  description: 'Dashboard profesional para administración de cobranza y pagos.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
