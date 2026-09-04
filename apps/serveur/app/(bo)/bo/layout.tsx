/**
 * ⛔ La garde. Tout ce qui vit sous `/bo` exige une session ouverte.
 *
 * ⚠️ Elle est répétée dans chaque action de serveur : celle-ci protège l’écran,
 *    celles-là protègent l’écriture (infra/backoffice/garde.ts).
 */
import type { ReactNode } from 'react'

import { exigerSession } from '../../../infra/backoffice/garde'

export default async function GardeBackOffice({ children }: { children: ReactNode }) {
  await exigerSession()
  return <>{children}</>
}
