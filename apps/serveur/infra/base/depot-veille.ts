/**
 * Le dépôt de la veille — l’état des incidents, et les faits qu’on mesure.
 *
 * ⛔ Toute la logique est de l’autre côté (`domaine/veille/alertes.ts`) : ici,
 *    du SQL, et rien qui décide.
 *
 * ⛔ AUCUNE REQUÊTE NE LIT LA PAROLE. Des dates, des statuts, des comptes et des
 *    identifiants : ce qui sort d’ici part chez Telegram.
 */
import type {
  GenreAlerte,
  IncidentOuvert,
  NotesImpossibles,
} from '../../domaine/veille/alertes'
import { GENRES_ALERTE } from '../../domaine/veille/alertes'
import { identifiant } from '../identifiants'

import type { Bassin } from './depot-retours'

const OUVERTES = `
  select id, genre, ouverte_le, envoyee_le, erreur
    from alertes
   where close_le is null
   order by ouverte_le asc
`

/**
 * ⛔ LA RÉSERVATION. L’index partiel `alertes_une_ouverte_par_genre` refuse un
 *    second incident ouvert du même genre : un conteneur qui arrive second
 *    n’obtient aucune ligne, donc ne prévient pas.
 */
const OUVRIR = `
  insert into alertes (id, genre)
  values ($1, $2)
  on conflict (genre) where close_le is null do nothing
  returning id
`

const FERMER = `
  update alertes
     set close_le = now(),
         maj_le = now()
   where id = $1
     and close_le is null
  returning id
`

/** ⚠️ `envoyee_le` n’est posée qu’en cas de succès, comme pour les notifications. */
const CONSIGNER = `
  update alertes
     set envoyee_le = case when $2::text is null then now() else null end,
         erreur = $2,
         maj_le = now()
   where id = $1
`

const DERNIERE_FERMETURE = `
  select max(close_le) as le from alertes where genre = $1
`

/**
 * ⚠️ `plafond` seulement : un retour sans parole n’est pas une panne.
 * ⚠️ Onze au plus pour la liste — le compte, lui, est entier.
 */
const IMPOSSIBLES = `
  select id,
         count(*) over () as total
    from retours
   where synthese_impossible_motif = 'plafond'
     and ($1::timestamptz is null or synthese_impossible_le > $1::timestamptz)
   order by synthese_impossible_le asc
   limit 11
`

const NOTE_DEPUIS = `
  select exists (select 1 from syntheses where cree_le > $1) as oui
`

/**
 * ⚠️ La pose est la création du plus ancien produit ACTIF : un produit désactivé
 *    n’attend plus rien.
 */
const RETOURS = `
  select (select max(cree_le) from retours) as dernier_le,
         (select min(cree_le) from produits where actif) as pose_le
`

const PART_VOIX = `
  select count(*) filter (where source = 'voix') as voix,
         count(*) as total
    from retours
   where cree_le >= $1
`

const PRODUITS = `
  select nom from produits where actif order by cree_le asc limit 5
`

function date(valeur: unknown): Date | null {
  return valeur instanceof Date ? valeur : null
}

function estGenre(valeur: unknown): valeur is GenreAlerte {
  return (GENRES_ALERTE as readonly unknown[]).includes(valeur)
}

export interface DepotVeille {
  ouvertes(): Promise<ReadonlyMap<GenreAlerte, IncidentOuvert>>
  ouvrir(genre: GenreAlerte): Promise<string | null>
  fermer(incidentId: string): Promise<boolean>
  consigner(incidentId: string, erreur: string | null): Promise<void>
  derniereFermeture(genre: GenreAlerte): Promise<Date | null>
  impossiblesDepuis(instant: Date | null): Promise<NotesImpossibles>
  noteEcriteDepuis(instant: Date): Promise<boolean>
  retours(): Promise<{ dernierLe: Date | null; poseLe: Date | null }>
  partVoix(depuis: Date): Promise<{ voix: number; total: number }>
  produits(): Promise<string[]>
}

export function creerDepotVeille(bassin: Bassin): DepotVeille {
  async function requete(texte: string, valeurs: readonly unknown[] = []) {
    const connexion = await bassin.connect()
    try {
      return (await connexion.query(texte, [...valeurs])).rows
    } finally {
      connexion.release()
    }
  }

  return {
    async ouvertes() {
      const lignes = await requete(OUVERTES)
      const parGenre = new Map<GenreAlerte, IncidentOuvert>()

      for (const ligne of lignes) {
        const genre = ligne['genre']
        const ouverteLe = date(ligne['ouverte_le'])
        if (!estGenre(genre) || ouverteLe === null) continue

        parGenre.set(genre, {
          id: String(ligne['id']),
          ouverteLe,
          envoyeeLe: date(ligne['envoyee_le']),
          erreur: typeof ligne['erreur'] === 'string' ? ligne['erreur'] : null,
        })
      }

      return parGenre
    },

    async ouvrir(genre) {
      const lignes = await requete(OUVRIR, [identifiant(), genre])
      const ligne = lignes[0]
      return ligne === undefined ? null : String(ligne['id'])
    },

    async fermer(incidentId) {
      return (await requete(FERMER, [incidentId])).length > 0
    },

    async consigner(incidentId, erreur) {
      await requete(CONSIGNER, [incidentId, erreur === null ? null : erreur.slice(0, 500)])
    },

    async derniereFermeture(genre) {
      return date((await requete(DERNIERE_FERMETURE, [genre]))[0]?.['le'])
    },

    async impossiblesDepuis(instant) {
      const lignes = await requete(IMPOSSIBLES, [instant])
      return {
        ids: lignes.map((ligne) => String(ligne['id'])),
        total: lignes.length === 0 ? 0 : Number(lignes[0]?.['total']),
      }
    },

    async noteEcriteDepuis(instant) {
      return (await requete(NOTE_DEPUIS, [instant]))[0]?.['oui'] === true
    },

    async retours() {
      const ligne = (await requete(RETOURS))[0]
      return { dernierLe: date(ligne?.['dernier_le']), poseLe: date(ligne?.['pose_le']) }
    },

    async partVoix(depuis) {
      const ligne = (await requete(PART_VOIX, [depuis]))[0]
      return { voix: Number(ligne?.['voix'] ?? 0), total: Number(ligne?.['total'] ?? 0) }
    },

    async produits() {
      return (await requete(PRODUITS)).map((ligne) => String(ligne['nom']))
    },
  }
}
