/**
 * Le dépôt des synthèses — l’implémentation du port que `domaine/synthese`
 * déclare.
 *
 * ⛔ Toute la logique est de l’autre côté : ici il n’y a que du SQL et une
 *    transaction (04-Architecture/architecture.md §3).
 *
 * ⚠️ Pas de borne par produit ici, et c’est délibéré : la synthèse est
 *    déclenchée par le serveur lui-même, APRÈS la clôture d’un entretien déjà
 *    autorisé. Aucune requête client n’atteint ce dépôt.
 */
import type {
  EtiquettesRetour,
  PortDepotSyntheses,
  RetourASynthetiser,
  SyntheseAEcrire,
} from '../../domaine/synthese/produire'
import { identifiant } from '../identifiants'

import type { Bassin } from './depot-retours'

const CHARGER = `
  select r.id,
         r.statut,
         r.auteur_nom,
         r.auteur_role,
         r.cree_le,
         c.url, c.titre_page, c.ecran, c.selecteur_dom,
         c.navigateur, c.systeme, c.viewport_l, c.viewport_h, c.fuseau
    from retours r
    left join contextes c on c.retour_id = r.id
   where r.id = $1
   limit 1
`

const FIL = `
  select role, texte
    from messages
   where retour_id = $1
   order by ordre asc
`

const DEJA_FAITE = 'select 1 from syntheses where retour_id = $1 limit 1'

/**
 * ⚠️ `confiance` est écrite DEUX fois : dans le `contenu` jsonb et dans sa
 *    colonne typée. C’est la seule extraction admise, et elle illustre la règle —
 *    ce qu’on interroge est une colonne, ce qu’on lit peut rester dans le
 *    document (04-Architecture/conventions-db.md §syntheses).
 */
const ECRIRE = `
  insert into syntheses (id, retour_id, contenu, modele, confiance, jetons_entree, jetons_sortie)
  values ($1, $2, $3::jsonb, $4, $5::confiance_synthese, $6, $7)
`

/**
 * ⛔ `type`, `titre` et `zone` sont des ÉTIQUETTES, corrigeables à la main au
 *    back-office. Rien de la parole n’est touché : le fil reste immuable
 *    (04-Architecture/conventions-db.md §Ce qu’on n’efface pas).
 */
const ETIQUETER = `
  update retours
     set type = $2::type_retour,
         titre = $3,
         zone = $4,
         maj_le = now()
   where id = $1
`

function ouNul(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.trim() !== '' ? valeur : null
}

function entierOuNul(valeur: unknown): number | null {
  return typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : null
}

export function creerDepotSyntheses(bassin: Bassin): PortDepotSyntheses {
  return {
    async charger(retourId: string): Promise<RetourASynthetiser | null> {
      const connexion = await bassin.connect()

      try {
        const { rows } = await connexion.query(CHARGER, [retourId])
        const ligne = rows[0]
        if (ligne === undefined) return null

        const messages = await connexion.query(FIL, [retourId])

        const fil = messages.rows.map((tour) => ({
          role: tour['role'] === 'bot' ? ('bot' as const) : ('collaborateur' as const),
          texte: String(tour['texte'] ?? ''),
        }))

        const recuLe = ligne['cree_le']

        return {
          id: String(ligne['id']),
          statut: String(ligne['statut']),
          fil,
          // ⚠️ Une ligne `bot` = une question posée. Le même compte qu’à
          //    l’entretien, et pour la même raison : c’est le fil qui fait foi.
          relancesPosees: fil.filter((tour) => tour.role === 'bot').length,
          contexte: {
            url: ouNul(ligne['url']),
            titrePage: ouNul(ligne['titre_page']),
            ecran: ouNul(ligne['ecran']),
            selecteurDom: ouNul(ligne['selecteur_dom']),
            navigateur: ouNul(ligne['navigateur']),
            systeme: ouNul(ligne['systeme']),
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

    async dejaFaite(retourId: string): Promise<boolean> {
      const connexion = await bassin.connect()

      try {
        const { rows } = await connexion.query(DEJA_FAITE, [retourId])
        return rows.length > 0
      } finally {
        connexion.release()
      }
    },

    /** ⛔ La note et ses étiquettes partent ensemble ou pas du tout. */
    async enregistrer(
      retourId: string,
      synthese: SyntheseAEcrire,
      etiquettes: EtiquettesRetour,
    ): Promise<void> {
      const connexion = await bassin.connect()

      try {
        await connexion.query('begin')

        await connexion.query(ECRIRE, [
          identifiant(),
          retourId,
          JSON.stringify(synthese.contenu),
          synthese.modele,
          synthese.confiance,
          synthese.jetonsEntree,
          synthese.jetonsSortie,
        ])

        await connexion.query(ETIQUETER, [
          retourId,
          etiquettes.type,
          etiquettes.titre,
          etiquettes.zone,
        ])

        await connexion.query('commit')
      } catch (erreur) {
        await connexion.query('rollback')
        throw erreur
      } finally {
        connexion.release()
      }
    },
  }
}
