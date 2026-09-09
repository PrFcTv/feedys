/**
 * Le dépôt de l’entretien — l’implémentation du port que `domaine/entretien`
 * déclare.
 *
 * ⛔ Toute la logique est de l’autre côté : ici il n’y a que du SQL et une
 *    transaction (04-Architecture/architecture.md §3).
 *
 * ⛔ Chaque requête est bornée par `produit_id`, déduit de la clé publique et
 *    jamais d’un paramètre client. Un identifiant de retour deviné ne donne donc
 *    accès à rien chez un autre produit (architecture.md §Sécurité).
 */
import type { GesteMessage } from '../../domaine/entretien/prompts'
import { GESTES } from '../../domaine/entretien/prompts'
import type {
  EntretienCharge,
  MessageAEcrire,
  PortDepotEntretien,
} from '../../domaine/entretien/tour'
import { identifiant } from '../identifiants'

import type { Bassin } from './depot-retours'
import { chargerIndices } from './indices'

/**
 * ⚠️ Le contexte est joint ici plutôt que dans une seconde requête : il est en
 *    1–1 avec le retour, et le bot ne peut pas parler sans lui — c’est ce qui
 *    l’empêche de redemander la page (01-Specs/entretien.md §1).
 */
const CHARGER = `
  select r.statut,
         r.auteur_nom,
         r.auteur_role,
         r.cree_le,
         c.url, c.titre_page, c.ecran, c.selecteur_dom,
         c.navigateur, c.systeme, c.viewport_l, c.viewport_h, c.fuseau,
         c.situation,
         p.contexte_metier
    from retours r
    left join contextes c on c.retour_id = r.id
    left join produits p on p.id = r.produit_id
   where r.id = $1
     and r.produit_id = $2
   limit 1
`

/** ⚠️ Trié sur `ordre`, jamais sur `cree_le` : deux tours peuvent partager la seconde. */
const FIL = `
  select role, texte, ordre, geste, axe, valeur_axe
    from messages
   where retour_id = $1
   order by ordre asc
`

const ECRIRE_MESSAGE = `
  insert into messages (id, retour_id, ordre, role, texte, transcript_brut, motif, geste, axe, valeur_axe)
  values ($1, $2, $3, $4, $5, $6, $7, $8::geste_message, $9, $10)
`

/**
 * ⚠️ `envoye_le` n’est posé que pour un envoi : un abandon n’a pas été envoyé
 *    par quelqu’un, il a été conservé. La colonne dit ce qui s’est passé.
 */
const CLORE = `
  update retours
     set statut = $2::statut_retour,
         envoye_le = case when $2 = 'envoye' then now() else envoye_le end,
         maj_le = now()
   where id = $1
     and statut = 'en_cours'
`

/**
 * ⛔ On ne fait pas confiance à ce que la base rend : une valeur inconnue devient
 *    `null`, c’est-à-dire « de la parole ». ⚠️ Le repli est délibérément du côté
 *    prudent pour le FIL — une ligne mal relue reste lisible — mais il est du
 *    mauvais côté pour les citations. C’est pourquoi l’énumération est la même
 *    des deux côtés et vérifiée par `migrations.integration.test.ts` : le repli
 *    ne doit jamais servir.
 */
function gesteOuNul(valeur: unknown): GesteMessage | null {
  return GESTES.find((connu) => connu === valeur) ?? null
}

function ouNul(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.trim() !== '' ? valeur : null
}

function entierOuNul(valeur: unknown): number | null {
  return typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : null
}

export function creerDepotEntretien(bassin: Bassin): PortDepotEntretien {
  return {
    async charger(retourId: string, produitId: string): Promise<EntretienCharge | null> {
      const connexion = await bassin.connect()

      try {
        const { rows } = await connexion.query(CHARGER, [retourId, produitId])
        const ligne = rows[0]
        if (ligne === undefined) return null

        const fil = await connexion.query(FIL, [retourId])

        const tours = fil.rows.map((tour) => ({
          role: tour['role'] === 'bot' ? ('bot' as const) : ('collaborateur' as const),
          texte: String(tour['texte'] ?? ''),
          geste: gesteOuNul(tour['geste']),
          axe: ouNul(tour['axe']),
          valeurAxe: ouNul(tour['valeur_axe']),
        }))

        const ordres = fil.rows.map((tour) => Number(tour['ordre'] ?? 0))
        const recuLe = ligne['cree_le']

        return {
          statut: String(ligne['statut']),
          fil: tours,
          // ⚠️ `max(ordre) + 1`, et pas le nombre de lignes : un trou dans la
          //    numérotation ne doit jamais faire écraser une ligne existante.
          prochainOrdre: ordres.length === 0 ? 0 : Math.max(...ordres) + 1,
          contexte: {
            url: ouNul(ligne['url']),
            titrePage: ouNul(ligne['titre_page']),
            ecran: ouNul(ligne['ecran']),
            situation: ouNul(ligne['situation']),
            contexteMetier: ouNul(ligne['contexte_metier']),
            selecteurDom: ouNul(ligne['selecteur_dom']),
            navigateur: ouNul(ligne['navigateur']),
            systeme: ouNul(ligne['systeme']),
            viewportL: entierOuNul(ligne['viewport_l']),
            viewportH: entierOuNul(ligne['viewport_h']),
            fuseau: ouNul(ligne['fuseau']),
            auteurNom: ouNul(ligne['auteur_nom']),
            auteurRole: ouNul(ligne['auteur_role']),
            recuLe: recuLe instanceof Date ? recuLe.toISOString() : ouNul(recuLe),
            // ⛔ Pour que le bot SE TAISE, pas pour qu’il parle : ils lui
            //    évitent de demander ce que la machine a déjà relevé (D-026).
            indices: await chargerIndices(connexion, retourId),
          },
        }
      } finally {
        connexion.release()
      }
    },

    /** ⛔ Les lignes partent ensemble ou pas du tout : un fil à trous ment. */
    async ecrire(retourId: string, messages: readonly MessageAEcrire[]): Promise<void> {
      if (messages.length === 0) return

      const connexion = await bassin.connect()

      try {
        await connexion.query('begin')

        for (const message of messages) {
          await connexion.query(ECRIRE_MESSAGE, [
            identifiant(),
            retourId,
            message.ordre,
            message.role,
            message.texte,
            message.transcriptBrut,
            message.motif,
            message.geste,
            message.axe,
            message.valeurAxe,
          ])
        }

        await connexion.query('commit')
      } catch (erreur) {
        await connexion.query('rollback')
        throw erreur
      } finally {
        connexion.release()
      }
    },

    async clore(retourId: string, statut: 'envoye' | 'abandonne'): Promise<void> {
      const connexion = await bassin.connect()

      try {
        await connexion.query(CLORE, [retourId, statut])
      } finally {
        connexion.release()
      }
    },
  }
}
