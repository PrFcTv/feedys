/**
 * Le dépôt des reprises — le SQL du port que `domaine/synthese/reprise` déclare.
 *
 * ⛔ Toute la logique est de l’autre côté (architecture.md §3). La règle
 *    d’espacement n’est pas réécrite ici : elle arrive en tableau d’instants,
 *    calculé par `limitesDeReprise`, et le SQL compare.
 *
 * ⚠️ Comme le dépôt du balayage, celui-ci n’est borné par aucun `produit_id` :
 *    il ne répond à personne, il tourne depuis le filet (D-018).
 */
import type { MotifRenoncement, RetourReserve } from '../../domaine/synthese/reprise'

import type { Bassin } from './depot-retours'

/**
 * Choisit UN retour clos, sans note, dont la reprise est due — et la compte.
 *
 * ⛔ C’EST LA RÉSERVATION. `for update skip locked` fait qu’un second conteneur
 *    ne voit pas la ligne que le premier tient, et `synthese_reprise_le = now()`
 *    la rend non due pour la passe d’à côté : deux passes n’appellent pas deux
 *    fois le modèle pour le même retour.
 *
 * ⚠️ QUELLE QUE SOIT LA FAÇON DONT IL A ÉTÉ CLOS. La requête de rattrapage de
 *    hebergement.md ne voyait que les retours refermés par le filet — une ligne
 *    `cloture_balayage` dans `audit`. Un entretien refermé par le widget, dont
 *    la synthèse avait échoué, n’en laisse aucune : il était invisible
 *    (BUGS_LOG 019). Ici on ne regarde que le statut et l’absence de note.
 *
 * ⚠️ `coalesce(synthese_reprise_le, maj_le)` : un retour jamais repris est jugé
 *    sur sa clôture, que `clore` date par `maj_le`. `$1[n + 1]` parce que les
 *    tableaux de Postgres commencent à 1 et que l’indice du domaine est le
 *    nombre de reprises déjà faites.
 *
 * ⛔ `envoye` et `abandonne` seulement. `en_cours` est l’affaire du balayage ;
 *    `lu`, `traite` et `ecarte` sont une décision humaine, et un retour qu’on a
 *    déjà lu ou écarté n’a pas à rappeler le modèle tout seul.
 */
const RESERVER = `
  with candidat as (
    select r.id
      from retours r
     where r.statut in ('envoye', 'abandonne')
       and r.synthese_impossible_le is null
       and coalesce(r.synthese_reprises, 0) < $2
       and coalesce(r.synthese_reprise_le, r.maj_le)
           < ($1::timestamptz[])[coalesce(r.synthese_reprises, 0) + 1]
       and not exists (select 1 from syntheses s where s.retour_id = r.id)
     order by r.cree_le asc
     limit 1
     for update of r skip locked
  )
  update retours
     set synthese_reprises = coalesce(retours.synthese_reprises, 0) + 1,
         synthese_reprise_le = now(),
         maj_le = now()
    from candidat
   where retours.id = candidat.id
  returning retours.id, retours.synthese_reprises
`

/**
 * ⚠️ `synthese_impossible_le is null` : renoncer deux fois ne redate pas le
 *    premier renoncement — c’est lui que l’alerte compare.
 */
const RENONCER = `
  update retours
     set synthese_impossible_le = now(),
         synthese_impossible_motif = $2,
         maj_le = now()
   where id = $1
     and synthese_impossible_le is null
`

export interface DepotReprise {
  reserver(limites: readonly Date[], plafond: number): Promise<RetourReserve | null>
  renoncer(retourId: string, motif: MotifRenoncement): Promise<void>
}

export function creerDepotReprise(bassin: Bassin): DepotReprise {
  return {
    async reserver(limites, plafond) {
      const connexion = await bassin.connect()

      try {
        const { rows } = await connexion.query(RESERVER, [
          limites.map((instant) => instant.toISOString()),
          plafond,
        ])
        const ligne = rows[0]
        if (ligne === undefined) return null

        return { retourId: String(ligne['id']), reprises: Number(ligne['synthese_reprises']) }
      } finally {
        connexion.release()
      }
    },

    async renoncer(retourId, motif) {
      const connexion = await bassin.connect()

      try {
        await connexion.query(RENONCER, [retourId, motif])
      } finally {
        connexion.release()
      }
    },
  }
}
