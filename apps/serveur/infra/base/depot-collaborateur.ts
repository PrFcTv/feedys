/**
 * L’accès en base pour les retours au collaborateur.
 *
 * ⛔ Toute la logique et les autorisations sont dans
 *    `domaine/retours/collaborateur.ts` : ici il n’y a que du SQL et des types.
 */
import type { ReponseCollaborateur } from '../../../../packages/widget/src/contrat'
import type { PortDepotCollaborateur } from '../../domaine/retours/collaborateur'
import type { Bassin } from './depot-retours'

function ouNul(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.trim() !== '' ? valeur : null
}

/**
 * ⛔ Une réponse jamais lue s’éteint au bout de `JOURS_DE_VIE`.
 *
 * ⚠️ Sans cette borne, la pastille du lanceur ne s’éteint jamais toute seule :
 *    elle reste posée des mois sur le widget de quelqu’un qui ne l’ouvrira
 *    plus. Or une pastille qui persiste sans être réclamée cesse d’être une
 *    information et devient une obligation — c’est-à-dire le badge de non-lus
 *    d’Intercom, celui que D-021 dit expressément ne PAS être.
 *
 * ⚠️ Trente jours, parce qu’au-delà le retour lui-même est oublié : « votre
 *    retour est corrigé » six semaines plus tard n’informe plus personne.
 *
 * ⛔ La ligne n’est pas touchée : `reponse_envoyee_le` et `reponse_texte`
 *    restent en base pour le back-office. C’est la RELEVE qui cesse, pas la
 *    trace.
 */
const JOURS_DE_VIE = 30

const RELEVER = `
  select id, titre, statut, reponse_texte, reponse_envoyee_le
    from retours
   where produit_id = $1
     and auteur_ref = $2
     and reponse_envoyee_le is not null
     and reponse_envoyee_le > now() - ($3 || ' days')::interval
     and reponse_lue_le is null
   order by reponse_envoyee_le desc
   limit 50
`

const TROUVER_AUTEUR = `
  select auteur_ref
    from retours
   where id = $1
     and produit_id = $2
   limit 1
`

const ACCUSER = `
  update retours
     set reponse_lue_le = coalesce(reponse_lue_le, $2),
         maj_le = now()
   where id = $1
`

export function creerDepotCollaborateur(bassin: Bassin): PortDepotCollaborateur {
  return {
    async releverReponses(produitId: string, auteurRef: string): Promise<ReponseCollaborateur[]> {
      const connexion = await bassin.connect()

      try {
        const { rows } = await connexion.query(RELEVER, [produitId, auteurRef, String(JOURS_DE_VIE)])

        return rows.map((ligne) => ({
          id: String(ligne['id']),
          titre: ouNul(ligne['titre']),
          statut: String(ligne['statut']),
          reponseTexte: ouNul(ligne['reponse_texte']),
          reponseEnvoyeeLe: (ligne['reponse_envoyee_le'] as Date).toISOString(),
        }))
      } finally {
        connexion.release()
      }
    },

    async trouverAuteurRef(retourId: string, produitId: string): Promise<string | null> {
      const connexion = await bassin.connect()

      try {
        const { rows } = await connexion.query(TROUVER_AUTEUR, [retourId, produitId])
        const premier = rows[0]
        if (premier === undefined) return null
        return ouNul(premier['auteur_ref'])
      } finally {
        connexion.release()
      }
    },

    async accuserReception(retourId: string, lueLe: Date): Promise<boolean> {
      const connexion = await bassin.connect()

      try {
        const resultat = await connexion.query(ACCUSER, [retourId, lueLe])
        return ((resultat as { rowCount?: number }).rowCount ?? 0) > 0
      } finally {
        connexion.release()
      }
    },
  }
}
