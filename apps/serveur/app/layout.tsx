import type { ReactNode } from 'react'

export const metadata = {
  title: 'Feedys',
  description: 'Le retour terrain, dicté.',
}

export default function Racine({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
