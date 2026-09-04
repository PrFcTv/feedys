/**
 * Le dépôt des notifications — le SQL du port que `domaine/notification` déclare.
 *
 * ⛔ Toute la logique est de l’autre côté (architecture.md §3).
 *
 * ⚠️ Pas de borne par produit : la notification est déclenchée par le serveur
 *    lui-même, après une clôture déjà autorisée. Aucune requête client n’arrive ici.
 */
import type {
  PortDepotNotifications,
} from '../../domaine/notification/envoyer'
import type { RetourANotifier } from '../../domaine/notification/message'
import { analyserSynthese } from '../../domaine/synthese/schema'
import { identifiant } from '../identifiants'

import type { Bassin } from './depot-retours'

/**
 * ⚠️ La jointure sur `syntheses` est INTERNE : sans note, il n’y a rien à
 *    envoyer, et une notification vide serait pire que pas de notification.
 */
const CHARGER = `
  select r.id,
         r.auteur_nom,
         r.auteur_role,
         r.cree_le,
         p.nom as produit_nom,
         s.contenu,
         c.url, c.navigateur, c.viewport_l, c.viewport_h, c.fuseau
    from retours r
    join produits p on p.id = r.produit_id
    join syntheses s on s.retour_id = r.id
    left join contextes c on c.retour_id = r.id
   where r.id = $1
   limit 1
`

const DEJA_ENVOYEE = 'select 1 from notifications where retour_id = $1 limit 1'

const OUVRIR = `
  insert into notifications (id, retour_id, canal, destinataire, statut)
  values ($1, $2, 'email'::canal_notification, $3, 'en_attente')
`

/**
 * ⚠️ `envoye_le` n’est posé qu’en cas de succès : une ligne `echoue` avec une
 *    date d’envoi mentirait au premier coup d’œil.
 */
const CLORE = `
  update notifications
     set statut = case when $2::text is null then 'envoye' else 'echoue' end,
         erreur = $2,
         envoye_le = case when $2::text is null then now() else null end,
         maj_le = now()
   where id = $1
`

function ouNul(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.trim() !== '' ? valeur : null
}

function entierOuNul(valeur: unknown): number | null {
  return typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : null
}

export function creerDepotNotifications(
  bassin: Bassin,
  urlPublique: string,
): PortDepotNotifications {
  return {
    async charger(retourId: string): Promise<RetourANotifier | null> {
      const connexion = await bassin.connect()

      try {
        const { rows } = await connexion.query(CHARGER, [retourId])
        const ligne = rows[0]
        if (ligne === undefined) return null

        // ⚠️ Le jsonb est RELU par le même schéma zod que celui qui l’a produit
        //    (01-Specs/synthese.md §Le schéma est UNE définition). Une note
        //    illisible ne s’envoie pas à moitié : elle ne s’envoie pas.
        const synthese = analyserSynthese(ligne['contenu'])
        if (synthese === undefined) return null

        const recuLe = ligne['cree_le']

        return {
          retourId: String(ligne['id']),
          produitNom: String(ligne['produit_nom']),
          synthese,
          urlPublique,
          contexte: {
            url: ouNul(ligne['url']),
            navigateur: ouNul(ligne['navigateur']),
            viewportL: entierOuNul(ligne['viewport_l']),
            viewportH: entierOuNul(ligne['viewport_h']),
            fuseau: ouNul(ligne['fuseau']),
            auteurNom: ouNul(ligne['auteur_nom']),
            auteurRole: ouNul(ligne['auteur_role']),
            recuLe: recuLe instanceof Date ? recuLe.toISOString() : ouNul(recuLe),
          },
        }
      } finally {
        connexion.release()
      }
    },

    async dejaEnvoyee(retourId: string): Promise<boolean> {
      const connexion = await bassin.connect()

      try {
        const { rows } = await connexion.query(DEJA_ENVOYEE, [retourId])
        return rows.length > 0
      } finally {
        connexion.release()
      }
    },

    async ouvrir(retourId: string, destinataire: string): Promise<string> {
      const connexion = await bassin.connect()
      const id = identifiant()

      try {
        await connexion.query(OUVRIR, [id, retourId, destinataire])
        return id
      } finally {
        connexion.release()
      }
    },

    async clore(notificationId: string, erreur: string | null): Promise<void> {
      const connexion = await bassin.connect()

      try {
        await connexion.query(CLORE, [notificationId, erreur])
      } finally {
        connexion.release()
      }
    },
  }
}
