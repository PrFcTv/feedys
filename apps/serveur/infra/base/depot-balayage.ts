/**
 * Le dépôt du filet — l’implémentation du port que `domaine/entretien/balayage`
 * déclare.
 *
 * ⛔ Toute la logique est de l’autre côté : ici il n’y a que du SQL et une
 *    transaction (04-Architecture/architecture.md §3).
 *
 * ⚠️ Ce dépôt est le seul qui ne soit **pas** borné par `produit_id` : il ne
 *    répond à personne. Il n’est jamais atteint par une requête HTTP — il tourne
 *    depuis `instrumentation.ts`, dans le processus, sans clé et sans origine
 *    (D-018). Un identifiant deviné ne lui donne donc rien : il n’en prend pas.
 */
import { identifiant } from '../identifiants'

import type { Bassin } from './depot-retours'

/**
 * Referme les entretiens muets, et rend ceux que CET appel a refermés.
 *
 * ⛔ C’EST ICI QUE LA DOUBLE SYNTHÈSE DEVIENT IMPOSSIBLE. Deux conteneurs qui
 *    balaient en même temps ne se partagent rien : `for update skip locked` fait
 *    que le second ne voit même pas les lignes que le premier tient, et le
 *    `statut = 'en_cours'` de l’`update` rejette celles qu’il aurait déjà
 *    refermées. Le `returning` ne rend donc que ce qu’on a soi-même flippé.
 *
 * ⚠️ `coalesce(max(cree_le), r.cree_le)` : un retour sans message est jugé sur
 *    sa création. C’est le cas d’une ingestion suivie d’aucun tour — il existe,
 *    il porte de la parole, et rien ne le refermerait sinon.
 *
 * ⚠️ La comparaison porte sur `$1`, l’instant limite calculé par le domaine.
 *    ⛔ La règle n’est pas réécrite ici : `balayage.ts` §estMuet en est la seule
 *    source, et `balayage.test.ts` prouve que les deux formes s’accordent.
 */
const REFERMER = `
  with candidats as (
    select r.id
      from retours r
     where r.statut = 'en_cours'
       and coalesce(
             (select max(m.cree_le) from messages m where m.retour_id = r.id),
             r.cree_le
           ) < $1
     order by r.cree_le asc
     limit $2
     for update skip locked
  )
  update retours
     set statut = 'abandonne',
         maj_le = now()
    from candidats
   where retours.id = candidats.id
     and retours.statut = 'en_cours'
  returning retours.id
`

/**
 * ⛔ Zone gelée : on n’y fait qu’INSERT (conventions-db.md §audit).
 *
 * ⚠️ C’est CE QUI DIRA SI LE FILET SERT VRAIMENT. Aucune clôture ordinaire
 *    n’écrit dans `audit` — ni un abandon volontaire, ni un envoi. La présence
 *    d’une ligne `cloture_balayage` identifie donc à elle seule ce que le filet
 *    a rattrapé, et son absence dit qu’il n’a rien eu à faire.
 */
const JOURNALISER = `
  insert into audit (id, retour_id, acteur, action, detail)
  select x.id, x.retour_id, 'systeme', 'cloture_balayage', $3::jsonb
    from unnest($1::text[], $2::text[]) as x(id, retour_id)
`

export interface DepotBalayage {
  clore(avant: Date, limite: number): Promise<string[]>
}

export function creerDepotBalayage(bassin: Bassin): DepotBalayage {
  return {
    /**
     * ⚠️ La clôture et sa trace d’audit sont dans LA MÊME transaction : un
     *    retour refermé sans sa ligne d’audit serait indiscernable d’un abandon
     *    volontaire, et le filet deviendrait invérifiable.
     *
     * ⛔ L’aval — synthèse et email — est DEHORS, et c’est délibéré : il appelle
     *    le modèle et le relais SMTP. Tenir une transaction ouverte pendant ce
     *    temps-là bloquerait des lignes pour plusieurs secondes.
     */
    async clore(avant: Date, limite: number): Promise<string[]> {
      const connexion = await bassin.connect()

      try {
        await connexion.query('begin')

        const refermes = await connexion.query(REFERMER, [avant, limite])
        const ids = refermes.rows.map((ligne) => String(ligne['id']))

        if (ids.length > 0) {
          await connexion.query(JOURNALISER, [
            ids.map(() => identifiant()),
            ids,
            JSON.stringify({ avant: avant.toISOString() }),
          ])
        }

        await connexion.query('commit')

        return ids
      } catch (erreur) {
        await connexion.query('rollback')
        throw erreur
      } finally {
        connexion.release()
      }
    },
  }
}
