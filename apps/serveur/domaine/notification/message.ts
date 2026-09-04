/**
 * Le message que le développeur reçoit — un mémo, pas un tableau de bord.
 *
 * ⛔ TEXTE LISIBLE, ET RIEN D’AUTRE. Pas de HTML riche, pas de logo, pas de
 *    bouton. Un email de Feedys doit rester lisible dans n’importe quel client,
 *    y compris en texte brut (01-Specs/synthese.md §Le rendu par email).
 *
 * ⛔ L’ORDRE EST IMPOSÉ : ce que c’est, ce qu’a dit la personne, ce qui manque,
 *    le contexte technique. Le contexte va en DERNIER parce qu’on ne le lit
 *    qu’en cas de besoin — le mettre en tête ferait relire six lignes de
 *    `user-agent` avant d’arriver à ce que quelqu’un a voulu dire.
 *
 * ⛔ Module pur : ni base, ni réseau, ni horloge (architecture.md §3). La date
 *    est celle du retour, passée dans le contexte ; rien ici ne lit `Date.now`.
 */
import type { ContexteEntretien } from '../entretien/prompts'
import type { Synthese } from '../synthese/schema'

/** Ce qui part. ⚠️ Deux chaînes : il n’y a pas de variante HTML, et il n’y en aura pas. */
export interface MessageEmail {
  readonly sujet: string
  readonly corps: string
}

export interface RetourANotifier {
  readonly retourId: string
  /** Le nom du produit — il est dans le sujet, c’est lui qui trie la boîte de réception. */
  readonly produitNom: string
  readonly synthese: Synthese
  readonly contexte: ContexteEntretien
  /** L’origine publique du serveur, sans barre finale. Sert au lien vers la fiche. */
  readonly urlPublique: string
}

/** Les libellés, dans les mots du produit (02-Metier/glossaire.md). */
const IMPACTS: Record<Synthese['impact'], string> = {
  bloque: 'bloque',
  ralentit: 'ralentit',
  agace: 'agace',
  indetermine: 'impact indéterminé',
}

const RECURRENCES: Record<NonNullable<Synthese['recurrence']>, string> = {
  premiere_fois: 'première fois',
  deja_vu: 'déjà vu',
  systematique: 'systématique',
}

/**
 * Le sujet.
 *
 * ⚠️ `[Feedys · <produit>]` en tête et le titre ensuite : c’est ce qui rend une
 *    règle de tri possible chez le lecteur sans qu’on ait à lui fournir un
 *    en-tête maison.
 */
export function sujetDe(retour: RetourANotifier): string {
  return `[Feedys · ${retour.produitNom}] ${retour.synthese.titre}`
}

/**
 * Le lien vers la fiche du back-office.
 *
 * ⚠️ La route est `/bo/r/:id` (P-010). Elle est composée ici plutôt que passée
 *    toute faite : un lien mort dans un email ne se remarque que des semaines
 *    plus tard, et il vaut mieux qu’un seul endroit le sache.
 */
export function lienFiche(urlPublique: string, retourId: string): string {
  return `${urlPublique.replace(/\/+$/, '')}/bo/r/${retourId}`
}

/**
 * La date du retour, en français, dans le fuseau du collaborateur.
 *
 * ⚠️ Le fuseau vient du navigateur : « 09:14 » doit être l’heure qu’il était
 *    POUR LA PERSONNE, pas celle du serveur. Un fuseau illisible ne fait pas
 *    échouer la note — on retombe sur la chaîne brute.
 */
export function dateLisible(iso: string | null | undefined, fuseau?: string | null): string | null {
  if (!iso) return null

  const quand = new Date(iso)
  if (Number.isNaN(quand.getTime())) return null

  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: fuseau?.trim() || 'UTC',
    })
      .format(quand)
      .replace(/,/g, ' à')
  } catch {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
      .format(quand)
      .replace(/,/g, ' à')
  }
}

/** ⚠️ Les libellés alignés sur une colonne : c’est ce qui rend un mémo lisible en monospace. */
function champ(libelle: string, valeur: string): string {
  return `  ${libelle.padEnd(11, ' ')}${valeur}`
}

function personneEtHeure(retour: RetourANotifier): string | null {
  const { contexte } = retour
  const nom = contexte.auteurNom?.trim()
  const role = contexte.auteurRole?.trim()
  const quand = dateLisible(contexte.recuLe, contexte.fuseau)

  const qui = nom ? (role ? `${nom} (${role})` : nom) : null
  const morceaux = [qui, quand].filter((valeur): valeur is string => valeur !== null)

  return morceaux.length === 0 ? null : morceaux.join(' · ')
}

function technique(retour: RetourANotifier): string | null {
  const { contexte } = retour
  const morceaux: string[] = []

  const url = contexte.url?.trim()
  if (url) morceaux.push(url)

  const navigateur = contexte.navigateur?.trim()
  if (navigateur) morceaux.push(navigateur)

  if (contexte.viewportL && contexte.viewportH) {
    morceaux.push(`${contexte.viewportL} × ${contexte.viewportH}`)
  }

  return morceaux.length === 0 ? null : morceaux.join(' · ')
}

/**
 * Le corps du message.
 *
 * ⚠️ Une synthèse en confiance basse se lit différemment : on ne planifie pas
 *    dessus, on va voir la personne. C’est pour ça que la confiance est sur la
 *    PREMIÈRE ligne, à côté du type — pas enfouie en pied de note.
 */
export function corpsDe(retour: RetourANotifier): string {
  const { synthese } = retour
  const blocs: string[] = []

  const entete = [
    `${synthese.type.toUpperCase()} · ${IMPACTS[synthese.impact]} · confiance ${synthese.confiance}`,
  ]
  const zone = synthese.zone.trim()
  if (zone) entete.push(zone)
  blocs.push(entete.join('\n'))

  blocs.push(synthese.resume)

  // ── ce que c’est, en détail ────────────────────────────────────────────────
  const details: string[] = []
  if (synthese.attendu) details.push(champ('Attendu', synthese.attendu))
  if (synthese.constate) details.push(champ('Constaté', synthese.constate))
  if (synthese.recurrence) details.push(champ('Récurrence', RECURRENCES[synthese.recurrence]))
  if (synthese.besoin) details.push(champ('Besoin', synthese.besoin))
  if (synthese.frequence) details.push(champ('Fréquence', synthese.frequence))
  if (details.length > 0) blocs.push(details.join('\n'))

  // ── ce qu’a dit la personne ────────────────────────────────────────────────
  //
  // ⛔ Les citations sont VERBATIM — elles ont été redécoupées dans le fil par
  //    domaine/synthese/verbatim.ts. On ne les retouche pas ici non plus : ni
  //    majuscule, ni point final, ni guillemets normalisés à l’intérieur.
  if (synthese.citations.length > 0) {
    blocs.push(
      ['CE QU’ELLE A DIT', ...synthese.citations.map((mot) => `  « ${mot} »`)].join('\n'),
    )
  }

  // ── ce qui manque ─────────────────────────────────────────────────────────
  //
  // ⚠️ Une liste vide est un signal, pas un défaut : on n’écrit alors PAS la
  //    rubrique. « Rien à signaler » ferait du bruit dans chaque note.
  if (synthese.questions_ouvertes.length > 0) {
    blocs.push(
      [
        'CE QU’ON NE SAIT PAS',
        ...synthese.questions_ouvertes.map((question) => `  · ${question}`),
      ].join('\n'),
    )
  }

  // ── le contexte technique, en dernier ─────────────────────────────────────
  const contexte = ['CONTEXTE']
  const qui = personneEtHeure(retour)
  if (qui) contexte.push(`  ${qui}`)
  const machine = technique(retour)
  if (machine) contexte.push(`  ${machine}`)
  contexte.push(`  → ouvrir la fiche : ${lienFiche(retour.urlPublique, retour.retourId)}`)
  blocs.push(contexte.join('\n'))

  return `${blocs.join('\n\n')}\n`
}

export function composerMessage(retour: RetourANotifier): MessageEmail {
  return { sujet: sujetDe(retour), corps: corpsDe(retour) }
}
