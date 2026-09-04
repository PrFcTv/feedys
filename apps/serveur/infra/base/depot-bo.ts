/**
 * Le dépôt du back-office — la liste, la fiche, et les deux corrections.
 *
 * ⛔ Toute la logique est de l’autre côté (architecture.md §3) : ici il n’y a que
 *    du SQL, des paramètres liés, et une transaction.
 *
 * ⛔ AUCUNE VALEUR DE FILTRE N’EST CONCATÉNÉE DANS LE SQL. Elles passent toutes
 *    en `$n`, y compris la zone saisie à la main.
 *
 * ⛔ ET AUCUNE ÉCRITURE NE TOUCHE `messages`. Ce dépôt ne connaît que `retours` et
 *    `audit` en écriture — la parole ne se réécrit pas
 *    (04-Architecture/conventions-db.md §Ce qu’on n’efface pas).
 */
import type {
  ChangementEtiquettes,
  ChangementStatut,
  LigneAudit,
} from '../../domaine/backoffice/correction'
import type { Filtres, Statut, TypeRetour } from '../../domaine/backoffice/filtres'
import { depuisDe } from '../../domaine/backoffice/filtres'
import type { Synthese } from '../../domaine/synthese/schema'
import { analyserSynthese } from '../../domaine/synthese/schema'
import { identifiant } from '../identifiants'

import type { Bassin } from './depot-retours'

/** ⚠️ Deux visites par jour, dix personnes : la liste n’a pas besoin de pagination. */
const PLAFOND_LISTE = 200

export interface LigneListe {
  readonly id: string
  readonly titre: string | null
  readonly statut: Statut
  readonly type: TypeRetour | null
  readonly zone: string | null
  readonly source: 'voix' | 'texte'
  readonly auteurNom: string | null
  readonly identiteVerifiee: boolean
  readonly produitNom: string
  readonly creeLe: Date
  readonly confiance: 'haute' | 'moyenne' | 'basse' | null
}

export interface TourFiche {
  readonly ordre: number
  readonly role: 'collaborateur' | 'bot'
  readonly texte: string
  readonly transcriptBrut: string | null
}

export interface ContexteFiche {
  readonly url: string | null
  readonly titrePage: string | null
  readonly ecran: string | null
  readonly selecteurDom: string | null
  readonly navigateur: string | null
  readonly systeme: string | null
  readonly viewportL: number | null
  readonly viewportH: number | null
  readonly fuseau: string | null
  readonly captureChemin: string | null
}

export interface Fiche {
  readonly id: string
  readonly statut: Statut
  readonly type: TypeRetour | null
  readonly titre: string | null
  readonly zone: string | null
  readonly source: 'voix' | 'texte'
  readonly auteurNom: string | null
  readonly auteurRole: string | null
  readonly identiteVerifiee: boolean
  readonly produitNom: string
  readonly creeLe: Date
  readonly envoyeLe: Date | null
  readonly synthese: Synthese | null
  readonly modele: string | null
  readonly fil: readonly TourFiche[]
  readonly contexte: ContexteFiche | null
  readonly notification: { readonly statut: string; readonly erreur: string | null } | null
}

const LISTE = `
  select r.id, r.titre, r.statut, r.type, r.zone, r.source,
         r.auteur_nom, r.identite_verifiee, r.cree_le,
         p.nom as produit_nom,
         s.confiance
    from retours r
    join produits p on p.id = r.produit_id
    left join syntheses s on s.retour_id = r.id
   where ($1::statut_retour is null or r.statut = $1::statut_retour)
     and ($2::type_retour is null or r.type = $2::type_retour)
     and ($3::text is null or r.zone ilike '%' || $3 || '%')
     and ($4::timestamptz is null or r.cree_le >= $4::timestamptz)
   order by r.cree_le desc
   limit ${PLAFOND_LISTE}
`

const FICHE = `
  select r.id, r.statut, r.type, r.titre, r.zone, r.source,
         r.auteur_nom, r.auteur_role, r.identite_verifiee, r.cree_le, r.envoye_le,
         p.nom as produit_nom,
         s.contenu, s.modele,
         c.url, c.titre_page, c.ecran, c.selecteur_dom, c.navigateur, c.systeme,
         c.viewport_l, c.viewport_h, c.fuseau, c.capture_chemin,
         n.statut as notification_statut, n.erreur as notification_erreur
    from retours r
    join produits p on p.id = r.produit_id
    left join syntheses s on s.retour_id = r.id
    left join contextes c on c.retour_id = r.id
    left join notifications n on n.retour_id = r.id
   where r.id = $1
   limit 1
`

const FIL = `
  select ordre, role, texte, transcript_brut
    from messages
   where retour_id = $1
   order by ordre asc
`

/** ⚠️ Les zones déjà vues : le filtre se choisit dans une liste, il ne se devine pas. */
const ZONES = `
  select distinct zone
    from retours
   where zone is not null and zone <> ''
   order by zone asc
   limit 100
`

const LIRE_AVANT = 'select statut, type, zone from retours where id = $1 for update'

const POSER_STATUT = `
  update retours set statut = $2::statut_retour, maj_le = now() where id = $1
`

const POSER_ETIQUETTES = `
  update retours set type = $2::type_retour, zone = $3, maj_le = now() where id = $1
`

/** ⛔ Zone gelée : on n’y fait qu’INSERT (conventions-db.md §audit). */
const JOURNALISER = `
  insert into audit (id, retour_id, acteur, action, detail)
  values ($1, $2, 'developpeur', $3, $4::jsonb)
`

function ouNul(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.trim() !== '' ? valeur : null
}

function entierOuNul(valeur: unknown): number | null {
  return typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : null
}

export type MotifRefusCorrectionBase = 'retour_inconnu'

export interface DepotBackOffice {
  lister(filtres: Filtres, maintenant: number): Promise<LigneListe[]>
  zonesConnues(): Promise<string[]>
  fiche(retourId: string): Promise<Fiche | null>
  changerStatut(retourId: string, changement: ChangementStatut): Promise<boolean>
  corrigerEtiquettes(retourId: string, changement: ChangementEtiquettes): Promise<boolean>
}

export function creerDepotBackOffice(bassin: Bassin): DepotBackOffice {
  /**
   * ⛔ La correction ET sa ligne d’audit partent ensemble ou pas du tout : un
   *    changement sans trace, c’est une histoire du retour qui ment.
   *
   * ⚠️ `for update` fige la ligne le temps de lire l’AVANT : sans lui, deux
   *    corrections concurrentes journaliseraient le même « avant ».
   */
  async function corriger(
    retourId: string,
    poser: { sql: string; parametres: readonly unknown[] },
    ligneDe: (avant: { statut: Statut; type: TypeRetour | null; zone: string | null }) => LigneAudit,
  ): Promise<boolean> {
    const connexion = await bassin.connect()

    try {
      await connexion.query('begin')

      const { rows } = await connexion.query(LIRE_AVANT, [retourId])
      const avant = rows[0]

      if (avant === undefined) {
        await connexion.query('rollback')
        return false
      }

      const ligne = ligneDe({
        statut: String(avant['statut']) as Statut,
        type: (ouNul(avant['type']) as TypeRetour | null) ?? null,
        zone: ouNul(avant['zone']),
      })

      await connexion.query(poser.sql, [retourId, ...poser.parametres])
      await connexion.query(JOURNALISER, [
        identifiant(),
        retourId,
        ligne.action,
        JSON.stringify(ligne.detail),
      ])

      await connexion.query('commit')
      return true
    } catch (erreur) {
      await connexion.query('rollback')
      throw erreur
    } finally {
      connexion.release()
    }
  }

  return {
    async lister(filtres: Filtres, maintenant: number): Promise<LigneListe[]> {
      const connexion = await bassin.connect()

      try {
        const { rows } = await connexion.query(LISTE, [
          filtres.statut,
          filtres.type,
          filtres.zone,
          depuisDe(filtres.periode, maintenant),
        ])

        return rows.map((ligne) => ({
          id: String(ligne['id']),
          titre: ouNul(ligne['titre']),
          statut: String(ligne['statut']) as Statut,
          type: (ouNul(ligne['type']) as TypeRetour | null) ?? null,
          zone: ouNul(ligne['zone']),
          source: ligne['source'] === 'texte' ? 'texte' : 'voix',
          auteurNom: ouNul(ligne['auteur_nom']),
          identiteVerifiee: ligne['identite_verifiee'] === true,
          produitNom: String(ligne['produit_nom']),
          creeLe: ligne['cree_le'] as Date,
          confiance: (ouNul(ligne['confiance']) as LigneListe['confiance']) ?? null,
        }))
      } finally {
        connexion.release()
      }
    },

    async zonesConnues(): Promise<string[]> {
      const connexion = await bassin.connect()

      try {
        const { rows } = await connexion.query(ZONES)
        return rows.map((ligne) => String(ligne['zone']))
      } finally {
        connexion.release()
      }
    },

    async fiche(retourId: string): Promise<Fiche | null> {
      const connexion = await bassin.connect()

      try {
        const { rows } = await connexion.query(FICHE, [retourId])
        const ligne = rows[0]
        if (ligne === undefined) return null

        const messages = await connexion.query(FIL, [retourId])

        const contexte: ContexteFiche | null =
          ligne['url'] === null || ligne['url'] === undefined
            ? null
            : {
                url: ouNul(ligne['url']),
                titrePage: ouNul(ligne['titre_page']),
                ecran: ouNul(ligne['ecran']),
                selecteurDom: ouNul(ligne['selecteur_dom']),
                navigateur: ouNul(ligne['navigateur']),
                systeme: ouNul(ligne['systeme']),
                viewportL: entierOuNul(ligne['viewport_l']),
                viewportH: entierOuNul(ligne['viewport_h']),
                fuseau: ouNul(ligne['fuseau']),
                captureChemin: ouNul(ligne['capture_chemin']),
              }

        const notificationStatut = ouNul(ligne['notification_statut'])

        return {
          id: String(ligne['id']),
          statut: String(ligne['statut']) as Statut,
          type: (ouNul(ligne['type']) as TypeRetour | null) ?? null,
          titre: ouNul(ligne['titre']),
          zone: ouNul(ligne['zone']),
          source: ligne['source'] === 'texte' ? 'texte' : 'voix',
          auteurNom: ouNul(ligne['auteur_nom']),
          auteurRole: ouNul(ligne['auteur_role']),
          identiteVerifiee: ligne['identite_verifiee'] === true,
          produitNom: String(ligne['produit_nom']),
          creeLe: ligne['cree_le'] as Date,
          envoyeLe: (ligne['envoye_le'] as Date | null) ?? null,
          synthese: analyserSynthese(ligne['contenu']) ?? null,
          modele: ouNul(ligne['modele']),
          fil: messages.rows.map((tour) => ({
            ordre: Number(tour['ordre']),
            role: tour['role'] === 'bot' ? ('bot' as const) : ('collaborateur' as const),
            texte: String(tour['texte'] ?? ''),
            transcriptBrut: ouNul(tour['transcript_brut']),
          })),
          contexte,
          notification:
            notificationStatut === null
              ? null
              : { statut: notificationStatut, erreur: ouNul(ligne['notification_erreur']) },
        }
      } finally {
        connexion.release()
      }
    },

    async changerStatut(retourId, changement): Promise<boolean> {
      return corriger(
        retourId,
        { sql: POSER_STATUT, parametres: [changement.statut] },
        (avant) => ({
          action: 'statut',
          detail: { avant: avant.statut, apres: changement.statut },
        }),
      )
    },

    async corrigerEtiquettes(retourId, changement): Promise<boolean> {
      return corriger(
        retourId,
        { sql: POSER_ETIQUETTES, parametres: [changement.type, changement.zone] },
        (avant) => ({
          action: 'etiquettes',
          detail: {
            avant: { type: avant.type, zone: avant.zone },
            apres: { type: changement.type, zone: changement.zone },
          },
        }),
      )
    },
  }
}
