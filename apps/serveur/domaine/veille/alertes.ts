/**
 * La veille — les alertes que hebergement.md écrivait sans que rien les code.
 *
 * ⚠️ POURQUOI ELLE EXISTE. Une installation par client, aucun « phone home »
 *    ([D-028]) : si rien ne prévient, rien ne remonte. Les trois seuils de
 *    hebergement.md §Ce qui doit être surveillé n’existaient qu’en prose
 *    (relecture du 2026-09-17), et la seule alerte du produit était un
 *    `console.warn` sur la machine d’un client.
 *
 * ⛔ QUATRE GENRES, ET PAS UN DE PLUS :
 *    - `notes_impossibles` — le filet a renoncé à au moins une note ;
 *    - `modele_en_echec`   — le modèle échoue au-delà du seuil ;
 *    - `aucun_retour`      — plus aucun retour depuis sept jours ;
 *    - `voix_minoritaire`  — la part de retours dictés passe sous 40 %.
 *    Les deux derniers sont des indicateurs d’usage : la phrase de contrat les
 *    nomme, un par un ([D-030], hebergement.md §1).
 *
 * ⛔ UNE ALERTE PAR INCIDENT, PAS UNE PAR PASSE. Un incident s’ouvre une fois —
 *    c’est le message —, puis se referme une fois — c’est la ligne « rétabli ».
 *    Entre les deux, les passes se taisent. L’état vit en base (`alertes`), et
 *    l’index partiel fait qu’un seul conteneur ouvre, donc prévient.
 *
 * ⛔ UNE ALERTE NE CONTIENT JAMAIS DE PAROLE NI DE NOM. Des nombres, des dates,
 *    des identifiants de retour — un cuid n’est pas de la parole (hebergement.md
 *    §Le filet) —, le produit et l’origine publique, qui disent de quelle
 *    installation il s’agit.
 *
 * ⛔ UNE ALERTE NE PASSE PAS PAR CE QU’ELLE SURVEILLE. Telegram, et lui seul :
 *    ni le SMTP, ni le modèle. Sans Telegram, elle reste en console, et le
 *    démarrage le dit.
 *
 * ⛔ Module pur (architecture.md §3). Aucune nouvelle infrastructure : la veille
 *    tourne dans la passe du filet (D-018).
 */
import { tronquer } from '../notification/telegram'

import type { EtatModele } from './modele'

export const GENRES_ALERTE = [
  'notes_impossibles',
  'modele_en_echec',
  'aucun_retour',
  'voix_minoritaire',
] as const

export type GenreAlerte = (typeof GENRES_ALERTE)[number]

const JOUR_MS = 24 * 60 * 60 * 1000

/** hebergement.md : « alerte à 0 sur 7 jours ». */
export const SILENCE_MAX_MS = 7 * JOUR_MS

/**
 * ⚠️ Trente jours pour la part de voix : sur sept, une dizaine de personnes ne
 *    font pas un échantillon, et la thèse du produit ne se juge pas à la semaine.
 */
export const FENETRE_VOIX_MS = 30 * JOUR_MS

/** ⚠️ En dessous, un pourcentage ne veut rien dire. */
export const MINIMUM_RETOURS_VOIX = 10

/** hebergement.md : « alerte sous 40 % ». */
export const PART_VOIX_ALERTE = 0.4

/** ⚠️ L’hystérésis, pour la même raison que celle du modèle. */
export const PART_VOIX_RETABLIE = 0.45

/** Au-delà, la liste des retours s’arrête : le back-office a le reste. */
const IDS_AFFICHES = 10

/**
 * Un verdict : `true` — l’incident devrait être ouvert ; `false` — fermé ;
 * `null` — on ne sait pas, et on ne touche à rien.
 */
export type Verdict = boolean | null

export function verdictModele(etat: EtatModele): Verdict {
  if (etat.etat === 'en_echec') return true
  if (etat.etat === 'sain') return false
  return null
}

/**
 * ⚠️ Un produit qui n’a encore rien reçu est jugé sur sa pose : sept jours après
 *    la création du produit sans un seul retour, la balise n’a probablement
 *    jamais été chargée. Sans produit actif, il n’y a rien à surveiller.
 */
export function verdictAucunRetour(
  dernierRetourLe: Date | null,
  poseLe: Date | null,
  maintenant: Date,
): Verdict {
  const reference = dernierRetourLe ?? poseLe
  if (reference === null) return null
  return maintenant.getTime() - reference.getTime() > SILENCE_MAX_MS
}

export function verdictVoix(voix: number, total: number): Verdict {
  if (total < MINIMUM_RETOURS_VOIX) return null

  const part = voix / total
  if (part < PART_VOIX_ALERTE) return true
  if (part >= PART_VOIX_RETABLIE) return false
  return null
}

/** Qui parle — ce qui distingue une installation d’une autre sur le même téléphone. */
export interface Installation {
  readonly produits: readonly string[]
  /** `FEEDYS_URL_PUBLIQUE`, sans barre finale. */
  readonly origine: string
}

function hote(origine: string): string {
  try {
    return new URL(origine).host
  } catch {
    return origine
  }
}

function entete(symbole: string, installation: Installation): string {
  const produits = installation.produits.length > 0 ? installation.produits.join(', ') : 'aucun produit'
  return `${symbole} Feedys · ${produits} · ${hote(installation.origine)}`
}

function lienListe(installation: Installation): string {
  return `→ ${installation.origine.replace(/\/+$/, '')}/bo`
}

function listeRetours(installation: Installation, ids: readonly string[], total: number): string[] {
  const base = installation.origine.replace(/\/+$/, '')
  const lignes = ids.slice(0, IDS_AFFICHES).map((id) => `  ${base}/bo/r/${id}`)
  if (total > lignes.length) lignes.push(`  … et ${total - lignes.length} autre(s), sur la liste`)
  return lignes
}

function pourcent(part: number): string {
  return `${Math.round(part * 100)} %`
}

export interface NotesImpossibles {
  readonly ids: readonly string[]
  readonly total: number
}

/** Les messages d’ouverture. ⛔ Aucune parole, aucun nom — des nombres et des identifiants. */
export const OUVERTURES = {
  notes_impossibles(installation: Installation, notes: NotesImpossibles): string {
    return tronquer(
      [
        entete('⚠️', installation),
        `${notes.total} note(s) devenue(s) impossible(s) : le modèle n’a pas répondu après toutes les reprises.`,
        'La parole est en base. Sur chaque fiche : « Refaire la note », une fois le modèle rétabli.',
        ...listeRetours(installation, notes.ids, notes.total),
      ].join('\n'),
      lienListe(installation),
    )
  },

  modele_en_echec(installation: Installation, etat: EtatModele): string {
    return [
      entete('⚠️', installation),
      `Le modèle échoue : ${etat.echecs} appel(s) sur ${etat.appels} depuis une heure.`,
      'Les notes manquantes seront redemandées toutes seules. Si ça dure : la clé, et le plafond du workspace (D-029).',
      lienListe(installation),
    ].join('\n')
  },

  aucun_retour(installation: Installation, dernierRetourLe: Date | null): string {
    return [
      entete('⚠️', installation),
      dernierRetourLe === null
        ? 'Aucun retour depuis la création du produit, il y a plus de sept jours.'
        : `Aucun retour depuis plus de sept jours — le dernier date du ${dernierRetourLe.toISOString().slice(0, 10)}.`,
      'La balise du widget est-elle toujours chargée chez l’hôte ?',
      lienListe(installation),
    ].join('\n')
  },

  voix_minoritaire(installation: Installation, voix: number, total: number): string {
    return [
      entete('⚠️', installation),
      `Retours dictés : ${voix} sur ${total} en trente jours (${pourcent(voix / total)}) — sous le seuil de ${pourcent(PART_VOIX_ALERTE)}.`,
      'C’est la thèse du produit qui est en jeu, pas une panne (VISION.md).',
    ].join('\n')
  },
}

/** Les messages de fermeture. */
export function fermeture(
  genre: GenreAlerte,
  installation: Installation,
  restees?: NotesImpossibles,
): string {
  const lignes = [entete('✅', installation)]

  switch (genre) {
    case 'notes_impossibles':
      lignes.push('Le modèle rédige de nouveau des notes.')
      if (restees !== undefined && restees.total > 0) {
        lignes.push(
          `${restees.total} autre(s) note(s) sont devenue(s) impossible(s) pendant l’incident — à refaire :`,
          ...listeRetours(installation, restees.ids, restees.total),
        )
      }
      break
    case 'modele_en_echec':
      lignes.push('Le modèle répond de nouveau.')
      break
    case 'aucun_retour':
      lignes.push('Un retour est de nouveau arrivé.')
      break
    case 'voix_minoritaire':
      lignes.push('La part de retours dictés est repassée au-dessus du seuil.')
      break
  }

  return tronquer(lignes.join('\n'), '')
}

export interface IncidentOuvert {
  readonly id: string
  readonly ouverteLe: Date
  readonly envoyeeLe: Date | null
  /** Pourquoi l’annonce n’est pas partie — le back-office l’affiche. */
  readonly erreur?: string | null
}

/** Les genres, dans les mots du back-office. */
export const LIBELLES_ALERTE: Record<GenreAlerte, string> = {
  notes_impossibles: 'des notes sont devenues impossibles',
  modele_en_echec: 'le modèle échoue',
  aucun_retour: 'aucun retour depuis sept jours',
  voix_minoritaire: 'la part de retours dictés est sous 40 %',
}

export interface PortsVeille {
  ouvertes(): Promise<ReadonlyMap<GenreAlerte, IncidentOuvert>>
  /** ⛔ La réservation : `null` si un incident de ce genre est déjà ouvert. */
  ouvrir(genre: GenreAlerte): Promise<string | null>
  /** `false` si un autre l’a déjà fermé. */
  fermer(incidentId: string): Promise<boolean>
  /** L’annonce est partie (`null`), ou pas, et pourquoi. */
  consigner(incidentId: string, erreur: string | null): Promise<void>

  derniereFermeture(genre: GenreAlerte): Promise<Date | null>
  /** Les retours auxquels le filet a renoncé faute de modèle, APRÈS cet instant. */
  impossiblesDepuis(instant: Date | null): Promise<NotesImpossibles>
  noteEcriteDepuis(instant: Date): Promise<boolean>
  retours(): Promise<{ readonly dernierLe: Date | null; readonly poseLe: Date | null }>
  partVoix(depuis: Date): Promise<{ readonly voix: number; readonly total: number }>
  etatModele(): EtatModele
  installation(): Promise<Installation>

  /**
   * Telegram. ⚠️ Absent quand il n’est pas configuré : l’alerte reste en console.
   * ⛔ Il ne lève qu’une erreur propre — le jeton n’y est pas (`telegram.ts`).
   */
  prevenir?: (texte: string) => Promise<void>
  /** La console, toujours — l’exploitant qui lit les journaux doit voir la même chose. */
  journal(texte: string): void
}

export interface BilanVeille {
  readonly ouverts: GenreAlerte[]
  readonly fermes: GenreAlerte[]
  /** Les genres dont la vérification a échoué — ⚠️ sans empêcher les autres. */
  readonly erreurs: Array<{ readonly genre: GenreAlerte; readonly erreur: unknown }>
}

export const TELEGRAM_ABSENT =
  'Telegram n’est pas configuré — l’alerte est restée en console (FEEDYS_TELEGRAM_JETON, FEEDYS_TELEGRAM_CHAT).'

async function annoncer(ports: PortsVeille, texte: string): Promise<string | null> {
  ports.journal(texte)

  if (ports.prevenir === undefined) return TELEGRAM_ABSENT

  try {
    await ports.prevenir(texte)
    return null
  } catch (erreur) {
    return erreur instanceof Error ? erreur.message : String(erreur)
  }
}

/**
 * Une passe de veille.
 *
 * ⚠️ Chaque genre est indépendant : un échec sur l’un n’empêche pas les autres.
 *    Il est rendu dans le bilan, et c’est l’appelant qui le journalise.
 */
export async function veiller(ports: PortsVeille, maintenant: Date = new Date()): Promise<BilanVeille> {
  const bilan: BilanVeille = { ouverts: [], fermes: [], erreurs: [] }
  const ouvertes = await ports.ouvertes()
  const installation = await ports.installation()

  async function tenter(genre: GenreAlerte, verifier: () => Promise<void>): Promise<void> {
    try {
      await verifier()
    } catch (erreur) {
      bilan.erreurs.push({ genre, erreur })
    }
  }

  async function ouvrirEtAnnoncer(genre: GenreAlerte, composer: () => string): Promise<void> {
    const id = await ports.ouvrir(genre)
    if (id === null) return

    bilan.ouverts.push(genre)
    await ports.consigner(id, await annoncer(ports, composer()))
  }

  async function fermerEtAnnoncer(
    genre: GenreAlerte,
    incident: IncidentOuvert,
    restees?: NotesImpossibles,
  ): Promise<void> {
    if (!(await ports.fermer(incident.id))) return

    bilan.fermes.push(genre)
    await annoncer(ports, fermeture(genre, installation, restees))
  }

  // ── les notes impossibles ──────────────────────────────────────────────────
  await tenter('notes_impossibles', async () => {
    const incident = ouvertes.get('notes_impossibles')

    if (incident === undefined) {
      const notes = await ports.impossiblesDepuis(await ports.derniereFermeture('notes_impossibles'))
      if (notes.total > 0) {
        await ouvrirEtAnnoncer('notes_impossibles', () => OUVERTURES.notes_impossibles(installation, notes))
      }
    } else if (await ports.noteEcriteDepuis(incident.ouverteLe)) {
      // ⚠️ Ce que l’ouverture n’avait pas encore vu est dit à la fermeture : ce
      //    sont les notes à refaire à la main.
      const restees = await ports.impossiblesDepuis(incident.envoyeeLe ?? incident.ouverteLe)
      await fermerEtAnnoncer('notes_impossibles', incident, restees)
    }
  })

  // ── le modèle ──────────────────────────────────────────────────────────────
  await tenter('modele_en_echec', async () => {
    const etat = ports.etatModele()
    const verdict = verdictModele(etat)
    const incident = ouvertes.get('modele_en_echec')

    if (verdict === true && incident === undefined) {
      await ouvrirEtAnnoncer('modele_en_echec', () => OUVERTURES.modele_en_echec(installation, etat))
    } else if (verdict === false && incident !== undefined) {
      await fermerEtAnnoncer('modele_en_echec', incident)
    }
  })

  // ── plus aucun retour ──────────────────────────────────────────────────────
  await tenter('aucun_retour', async () => {
    const { dernierLe, poseLe } = await ports.retours()
    const verdict = verdictAucunRetour(dernierLe, poseLe, maintenant)
    const incident = ouvertes.get('aucun_retour')

    if (verdict === true && incident === undefined) {
      await ouvrirEtAnnoncer('aucun_retour', () => OUVERTURES.aucun_retour(installation, dernierLe))
    } else if (verdict !== true && incident !== undefined) {
      // ⚠️ `null` ferme aussi : sans produit actif, il n’y a plus rien à attendre.
      await fermerEtAnnoncer('aucun_retour', incident)
    }
  })

  // ── la part de voix ────────────────────────────────────────────────────────
  await tenter('voix_minoritaire', async () => {
    const { voix, total } = await ports.partVoix(new Date(maintenant.getTime() - FENETRE_VOIX_MS))
    const verdict = verdictVoix(voix, total)
    const incident = ouvertes.get('voix_minoritaire')

    if (verdict === true && incident === undefined) {
      await ouvrirEtAnnoncer('voix_minoritaire', () =>
        OUVERTURES.voix_minoritaire(installation, voix, total),
      )
    } else if (verdict === false && incident !== undefined) {
      await fermerEtAnnoncer('voix_minoritaire', incident)
    }
  })

  return bilan
}
