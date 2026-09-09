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
import { auditStatut } from '../../domaine/backoffice/correction'
import type { Filtres, Statut, TypeRetour } from '../../domaine/backoffice/filtres'
import { depuisDe } from '../../domaine/backoffice/filtres'
import { lienCorrectif } from '../../domaine/retours/correctif'
import { lienIndice } from '../../domaine/retours/indice'
import type { Synthese } from '../../domaine/synthese/schema'
import { analyserSynthese } from '../../domaine/synthese/schema'
import { identifiant } from '../identifiants'

import type { Bassin } from './depot-retours'
import { chargerIndices } from './indices'
import { ecritureStatut } from './sql-statut'

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

/**
 * Un indice technique tel que la fiche l’affiche.
 *
 * ⛔ Il n’y a pas de champ `message`, et ce n’est pas une omission : la colonne
 *    n’existe pas en base (D-026). Le développeur a la trame, qui localise, et
 *    la référence, qui l’emmène chez son propre outil — où le message est, avec
 *    la pile démappée et la version.
 */
export interface IndiceFiche {
  readonly genre: string
  readonly nom: string | null
  readonly trame: string | null
  readonly statut: number | null
  readonly chemin: string | null
  readonly methode: string | null
  readonly reference: string | null
  readonly ecartMs: number | null
  /** ⚠️ `null` quand le produit n’a pas déclaré d’outil : la référence reste lisible. */
  readonly url: string | null
}

/**
 * Ce qui a corrigé le retour.
 *
 * ⛔ Le back-office l’AFFICHE, il ne le saisit pas : le correctif se consigne
 *    par `marquer_retour`, là où l’agent a le dépôt sous la main. Ajouter un
 *    champ de plus au formulaire élargirait la surface modifiable à la main,
 *    que ce back-office garde volontairement étroite
 *    (01-Specs/back-office.md §Les seules corrections possibles).
 */
export interface CorrectifFiche {
  readonly ref: string | null
  readonly note: string | null
  readonly le: Date | null
  /** ⚠️ Composée, jamais appelée : Feedys ne parle pas à la forge (D-024). */
  readonly url: string | null
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
  readonly reponseTexte: string | null
  readonly reponseEnvoyeeLe: Date | null
  readonly reponseLueLe: Date | null
  readonly correctif: CorrectifFiche | null
  readonly synthese: Synthese | null
  readonly modele: string | null
  readonly fil: readonly TourFiche[]
  readonly contexte: ContexteFiche | null
  /** Ce que le navigateur a relevé avant l’ouverture (P-028). ⚠️ Liste vide si rien. */
  readonly indices: readonly IndiceFiche[]
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
         r.reponse_texte, r.reponse_envoyee_le, r.reponse_lue_le,
         r.correctif_ref, r.correctif_note, r.correctif_le,
         p.nom as produit_nom, p.url_forge, p.url_observabilite,
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

        // ⚠️ Le lien est composé ICI, à la lecture, et jamais stocké : le
        //    gabarit du produit peut changer, et une URL figée en base
        //    pointerait vers l’outil d’hier. Même choix que `lienCorrectif`.
        const urlObservabilite = ouNul(ligne['url_observabilite'])
        const indices = (await chargerIndices(connexion, retourId)).map((indice) => ({
          ...indice,
          url: lienIndice(urlObservabilite, indice.reference),
        }))

        const notificationStatut = ouNul(ligne['notification_statut'])

        const correctifRef = ouNul(ligne['correctif_ref'])
        const correctifNote = ouNul(ligne['correctif_note'])

        const correctif: CorrectifFiche | null =
          correctifRef === null && correctifNote === null
            ? null
            : {
                ref: correctifRef,
                note: correctifNote,
                le: (ligne['correctif_le'] as Date | null) ?? null,
                url: lienCorrectif(ouNul(ligne['url_forge']), correctifRef),
              }

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
          reponseTexte: ouNul(ligne['reponse_texte']),
          reponseEnvoyeeLe: (ligne['reponse_envoyee_le'] as Date | null) ?? null,
          reponseLueLe: (ligne['reponse_lue_le'] as Date | null) ?? null,
          correctif,
          synthese: analyserSynthese(ligne['contenu']) ?? null,
          modele: ouNul(ligne['modele']),
          fil: messages.rows.map((tour) => ({
            ordre: Number(tour['ordre']),
            role: tour['role'] === 'bot' ? ('bot' as const) : ('collaborateur' as const),
            texte: String(tour['texte'] ?? ''),
            transcriptBrut: ouNul(tour['transcript_brut']),
          })),
          contexte,
          indices,
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
      const ecriture = ecritureStatut(changement.statut, changement.reponse)

      return corriger(
        retourId,
        ecriture,
        // ⚠️ La ligne d’audit se construit dans `domaine/backoffice/correction.ts`
        //    et nulle part ailleurs : la journalisation est une règle, pas du SQL.
        (avant) => auditStatut(avant.statut, changement.statut, ecriture.mot ?? undefined),
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
