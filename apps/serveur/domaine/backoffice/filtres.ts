/**
 * Les filtres de la liste du back-office.
 *
 * ⛔ Module pur : ni base, ni réseau, ni horloge (architecture.md §3). Le
 *    « maintenant » de la période est PASSÉ, ce qui rend la borne testable sans
 *    figer une horloge.
 *
 * ⚠️ TOUT CE QUI N’EST PAS RECONNU EST IGNORÉ, jamais refusé. Une liste est une
 *    lecture : un paramètre d’URL abîmé doit rendre la liste complète, pas une
 *    page d’erreur. ⛔ Les valeurs reconnues, elles, sont une liste close — c’est
 *    ce qui empêche un paramètre d’URL d’atteindre le SQL.
 */

/** ⚠️ Les six statuts de l’enum `statut_retour`, dans l’ordre du cycle de vie. */
export const STATUTS = ['en_cours', 'abandonne', 'envoye', 'lu', 'traite', 'ecarte'] as const
export type Statut = (typeof STATUTS)[number]

export const TYPES = ['bug', 'idee', 'question', 'gene'] as const
export type TypeRetour = (typeof TYPES)[number]

export const PERIODES = ['tout', '24h', '7j', '30j'] as const
export type Periode = (typeof PERIODES)[number]

export const LIBELLES_STATUT: Record<Statut, string> = {
  en_cours: 'en cours',
  abandonne: 'abandonné',
  envoye: 'envoyé',
  lu: 'lu',
  traite: 'traité',
  ecarte: 'écarté',
}

export const LIBELLES_TYPE: Record<TypeRetour, string> = {
  bug: 'bug',
  idee: 'idée',
  question: 'question',
  gene: 'gêne',
}

export const LIBELLES_PERIODE: Record<Periode, string> = {
  tout: 'depuis toujours',
  '24h': 'dernières 24 h',
  '7j': '7 derniers jours',
  '30j': '30 derniers jours',
}

/** ⚠️ La zone est saisie à la main : on borne sa longueur, elle part dans un `like`. */
const LONGUEUR_ZONE = 200

export interface Filtres {
  readonly statut: Statut | null
  readonly type: TypeRetour | null
  readonly zone: string | null
  readonly periode: Periode
}

export const AUCUN_FILTRE: Filtres = { statut: null, type: null, zone: null, periode: 'tout' }

function dansLaListe<T extends string>(liste: readonly T[], valeur: unknown): T | null {
  return typeof valeur === 'string' && (liste as readonly string[]).includes(valeur)
    ? (valeur as T)
    : null
}

/** Lit les paramètres d’URL. ⚠️ Ce qui n’est pas reconnu tombe, sans bruit. */
export function lireFiltres(params: Record<string, string | string[] | undefined>): Filtres {
  const premier = (nom: string): string | undefined => {
    const valeur = params[nom]
    return Array.isArray(valeur) ? valeur[0] : valeur
  }

  const zone = premier('zone')?.trim().slice(0, LONGUEUR_ZONE)

  return {
    statut: dansLaListe(STATUTS, premier('statut')),
    type: dansLaListe(TYPES, premier('type')),
    zone: zone ? zone : null,
    periode: dansLaListe(PERIODES, premier('periode')) ?? 'tout',
  }
}

const HEURE = 3_600_000

const DUREES: Record<Exclude<Periode, 'tout'>, number> = {
  '24h': 24 * HEURE,
  '7j': 7 * 24 * HEURE,
  '30j': 30 * 24 * HEURE,
}

/** La borne basse de la période. ⚠️ `null` pour « depuis toujours ». */
export function depuisDe(periode: Periode, maintenant: number): Date | null {
  return periode === 'tout' ? null : new Date(maintenant - DUREES[periode])
}

export function auMoinsUnFiltre(filtres: Filtres): boolean {
  return (
    filtres.statut !== null ||
    filtres.type !== null ||
    filtres.zone !== null ||
    filtres.periode !== 'tout'
  )
}

/**
 * Réécrit la requête d’URL. ⚠️ Les filtres vides ne s’écrivent PAS : une URL de
 * liste doit rester lisible et se recopier dans un message.
 */
export function requeteDe(filtres: Filtres): string {
  const params = new URLSearchParams()

  if (filtres.statut) params.set('statut', filtres.statut)
  if (filtres.type) params.set('type', filtres.type)
  if (filtres.zone) params.set('zone', filtres.zone)
  if (filtres.periode !== 'tout') params.set('periode', filtres.periode)

  const requete = params.toString()
  return requete === '' ? '' : `?${requete}`
}
