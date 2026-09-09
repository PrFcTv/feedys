/**
 * La lecture des indices d’un retour — une seule requête, trois lecteurs.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE. `depot-entretien`, `depot-syntheses` et
 *    `depot-bo` ont tous les trois besoin de la même chose : « les indices de
 *    CE retour, dans l’ordre ». Recopier la requête trois fois, c’est garantir
 *    qu’au premier champ ajouté l’un des trois sera oublié — et l’oubli serait
 *    silencieux, puisqu’une colonne absente vaut `undefined`, donc une ligne en
 *    moins dans un prompt que personne ne relit.
 *
 * ⛔ Ce module ne fait que du SQL et de la relecture. Aucune décision : la
 *    forme, les bornes et le plafond sont ailleurs (architecture.md §3).
 */
import type { ConnexionBase } from './migrations'

/**
 * ⚠️ Trié sur `ordre`, jamais sur `cree_le` : les trois lignes sont écrites
 *    dans la même transaction, à la même microseconde, et `cree_le` ne les
 *    départagerait pas. L’ordre porte du sens — deux indices dans l’ordre
 *    racontent une séquence.
 *
 * ⛔ `message` n’est pas dans la liste parce que la colonne n’existe pas
 *    (D-026). Ce n’est pas un oubli à réparer un jour.
 */
export const CHARGER_INDICES = `
  select ordre, genre, nom, trame, statut, chemin, methode, reference, ecart_ms
    from indices
   where retour_id = $1
   order by ordre asc
`

/** Un indice relu depuis la base. ⛔ Il n’y a pas de champ `message`. */
export interface IndiceLu {
  readonly genre: string
  readonly nom: string | null
  readonly trame: string | null
  readonly statut: number | null
  readonly chemin: string | null
  readonly methode: string | null
  readonly reference: string | null
  readonly ecartMs: number | null
}

function ouNul(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.trim() !== '' ? valeur : null
}

function entierOuNul(valeur: unknown): number | null {
  const nombre = typeof valeur === 'string' ? Number(valeur) : valeur
  return typeof nombre === 'number' && Number.isFinite(nombre) ? nombre : null
}

/**
 * ⚠️ `genre` est relu sans être cru : la colonne est une énumération Postgres,
 *    mais ce qui remonte est une chaîne, et le reste du code décide sur elle.
 */
export function lireIndices(lignes: readonly Record<string, unknown>[]): readonly IndiceLu[] {
  return lignes.map((ligne) => ({
    genre: String(ligne['genre'] ?? ''),
    nom: ouNul(ligne['nom']),
    trame: ouNul(ligne['trame']),
    statut: entierOuNul(ligne['statut']),
    chemin: ouNul(ligne['chemin']),
    methode: ouNul(ligne['methode']),
    reference: ouNul(ligne['reference']),
    ecartMs: entierOuNul(ligne['ecart_ms']),
  }))
}

/** Les indices d’un retour, prêts à l’emploi. ⚠️ Liste vide plutôt que `null`. */
export async function chargerIndices(
  connexion: ConnexionBase,
  retourId: string,
): Promise<readonly IndiceLu[]> {
  const { rows } = await connexion.query(CHARGER_INDICES, [retourId])
  return lireIndices(rows as Record<string, unknown>[])
}
