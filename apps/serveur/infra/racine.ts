/**
 * La racine du dépôt, trouvée en remontant depuis le dossier de travail.
 *
 * ⚠️ `next dev` tourne avec `apps/serveur` pour dossier courant, `pnpm dev`
 *    depuis la racine, `vitest` depuis la racine aussi. Les trois doivent
 *    marcher sans configuration : un `/widget.js` en 503 ou un prompt introuvable
 *    sur un poste se diagnostiquent très mal.
 *
 * ⚠️ Les marqueurs `turbopackIgnore` ne sont pas du bruit : Turbopack essaie de
 *    résoudre les chemins de fichiers à la CONSTRUCTION et avertit sur chacun de
 *    ceux qu’il ne peut pas prédire. Ici c’est voulu — l’emplacement dépend du
 *    dossier de travail, connu au démarrage seulement.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'

/** ⚠️ Le fichier qui marque la racine : il n’existe qu’à un seul endroit. */
const MARQUEUR = 'pnpm-workspace.yaml'

export function racineDepot(): string | undefined {
  let dossier = process.cwd()

  for (let remontees = 0; remontees < 6; remontees += 1) {
    if (existsSync(/*turbopackIgnore: true*/ path.join(dossier, MARQUEUR))) return dossier

    const parent = path.dirname(dossier)
    if (parent === dossier) break
    dossier = parent
  }

  return undefined
}
