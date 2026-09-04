import type { ReactNode } from 'react'

import './global.css'
import { CLASSES_POLICES } from './polices'

export const metadata = {
  title: 'Feedys',
  description: 'Le retour terrain, dicté.',
}

export default function Racine({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={CLASSES_POLICES}>
      <body>{children}</body>
    </html>
  )
}
