/**
 * La vérification d’origine.
 *
 * Le widget s’exécute dans la page d’autrui et poste vers un autre domaine : le
 * navigateur applique CORS. Ce module décide, pour un produit donné, si une
 * origine a le droit de parler.
 *
 * ⛔ Fonction pure. Elle ne connaît ni requête, ni base, ni en-tête.
 */

/**
 * L’hôte d’un `domaine` de produit.
 *
 * Le champ est saisi à la main par `pnpm produit:creer` : il arrive tantôt en
 * `victoria.exemple.fr`, tantôt en `https://victoria.exemple.fr/`. Les deux
 * doivent marcher — un refus d’origine se diagnostique mal, et personne ne
 * pensera au slash.
 */
export function hoteDe(domaine: string): string | null {
  const brut = domaine.trim().toLowerCase()
  if (brut === '') return null

  const avecSchema = brut.includes('://') ? brut : `https://${brut}`

  try {
    const hote = new URL(avecSchema).hostname
    return hote === '' ? null : hote
  } catch {
    return null
  }
}

/**
 * L’origine a-t-elle le droit de poster pour ce produit ?
 *
 * Trois cas, et le premier est le moins évident :
 *
 * 1. **Pas d’en-tête `Origin` du tout** → autorisé. Ce n’est pas un navigateur :
 *    c’est un `curl`, un test, ou l’appel d’un serveur. CORS protège l’onglet de
 *    quelqu’un, pas l’API — 04-Architecture/architecture.md §Sécurité admet
 *    explicitement que n’importe qui poste avec la clé publique.
 * 2. **`Origin: null`** → refusé. C’est une iframe bac à sable ou un `file://`,
 *    et aucun logiciel métier n’est servi de là.
 * 3. Sinon, l’hôte de l’origine doit être **exactement** celui du produit.
 *
 * ⚠️ Le port et le schéma sont ignorés : le même logiciel se sert en `:3000` sur
 *    un poste et en `:443` en production. ⛔ Pas de joker de sous-domaine :
 *    `mechant.exemple.fr` ne parle pas pour `exemple.fr`.
 */
export function origineAutorisee(origine: string | null | undefined, domaine: string): boolean {
  if (origine === null || origine === undefined || origine.trim() === '') return true

  const attendu = hoteDe(domaine)
  if (attendu === null) return false

  const brut = origine.trim().toLowerCase()
  if (brut === 'null') return false

  try {
    return new URL(brut).hostname === attendu
  } catch {
    return false
  }
}
