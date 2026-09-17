/**
 * Telegram — le canal recommandé ([D-030]).
 *
 * ⚠️ POURQUOI LUI. Deux variables, un bot créé en une minute, et le message
 *    arrive sur le téléphone de celui qui maintient le logiciel. L’email demande
 *    un relais SMTP par client, c’est-à-dire le réglage le plus souvent raté
 *    d’une installation. L’email reste, tel quel : il cesse seulement d’être
 *    celui qu’on recommande en premier.
 *
 * ⛔ UN POINTEUR, PAS LA NOTE. Le message porte le type du retour, le produit,
 *    la date et le lien vers la fiche — ni titre, ni résumé, ni citation, ni
 *    nom, ni URL de la page de l’hôte. Les échanges avec un bot sont stockés
 *    chez Telegram Messenger Inc., hors de l’EEE, sans chiffrement de bout en
 *    bout et sans contrat de sous-traitance proposé (vérifié le 2026-09-17,
 *    politique du 2026-08-21). La parole ne passe donc pas par lui. Le titre
 *    non plus : le modèle l’écrit à partir de la parole, et il peut porter un
 *    nom.
 *
 * ⛔ LE JETON EST DANS L’URL, et c’est le piège de cette API. Une erreur réseau
 *    qui recopie l’URL le ferait fuir dans `notifications.erreur`, dans
 *    `signaler`, dans les journaux. Toute erreur sortant d’ici est donc une
 *    `ErreurTelegram` NEUVE, nettoyée, sans `cause` : l’erreur d’origine ne
 *    remonte jamais.
 *
 * ⛔ TEXTE BRUT, AUCUN `parse_mode`. En `MarkdownV2`, dix-huit caractères sont à
 *    échapper, et un seul oublié rend 400. Sans `parse_mode`, Telegram
 *    n’interprète rien : `<b>`, `&` et `_*[` arrivent tels quels.
 *
 * ⛔ SENS UNIQUE. Ni `getUpdates`, ni webhook, ni commande : le bot ne lit rien.
 *    Sinon Feedys devient un canal de support ([D-021], ROADMAP §Ce qui
 *    n’arrivera pas). `sendMessage` est la seule méthode appelée.
 *
 * ⛔ Module pur : le réseau entre par `fetch`, l’attente par `attendre`
 *    (architecture.md §3). Aucune dépendance : le `fetch` natif suffit.
 */
import type { TypeRetour } from '../backoffice/filtres'
import { LIBELLES_TYPE } from '../backoffice/filtres'

import type { PortCanal } from './envoyer'
import type { RetourANotifier } from './message'
import { dateLisible, lienFiche } from './message'

export interface ReglagesTelegram {
  /** `FEEDYS_TELEGRAM_JETON`. ⛔ Ne sort jamais : ni en base, ni en journal. */
  readonly jeton: string
  /** `FEEDYS_TELEGRAM_CHAT`. ⚠️ Négatif pour un groupe — c’est normal. */
  readonly chat: string
}

/** Le strict nécessaire de `fetch` — ce que les tests remplacent. */
export type Recuperer = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ status: number; json(): Promise<unknown> }>

export interface PortsTelegram {
  readonly fetch: Recuperer
  /** ⚠️ L’attente d’un 429. Injectée : un test n’attend pas trente secondes. */
  readonly attendre: (ms: number) => Promise<void>
  /** Le délai d’un appel. ⛔ Jamais l’attente infinie (BUGS_LOG 013). */
  readonly delaiMs?: number
}

/**
 * ⚠️ Dix secondes : Telegram répond en quelques centaines de millisecondes. Au
 *    delà, il ne répondra pas mieux, et la passe du filet attend derrière.
 */
export const DELAI_TELEGRAM_MS = 10_000

/** La limite de Telegram pour un message, en caractères. */
export const LONGUEUR_MAX = 4096

/**
 * ⚠️ Au-delà, on ne patiente pas : une passe du filet ne se suspend pas une
 *    minute pour un message. L’envoi est déclaré en échec, avec l’attente
 *    demandée.
 */
const ATTENTE_MAX_S = 30

/** Deux nouvelles tentatives au plus après un 429. ⛔ Jamais de boucle. */
const TENTATIVES_429 = 2

const REMPLACEMENT = '‹jeton›'

/**
 * La forme d’un jeton de bot : un identifiant numérique, deux-points, un secret.
 *
 * ⚠️ Filet de sécurité SOUS le remplacement littéral : un jeton recopié avec une
 *    espace en moins, ou celui d’un autre bot cité par une erreur, reste masqué.
 */
const FORME_JETON = /\d{6,}:[A-Za-z0-9_-]{20,}/g

/**
 * Retire le jeton de tout texte qui pourrait sortir d’ici.
 *
 * ⛔ Appliqué à TOUTE erreur avant `notifications.erreur` et avant `signaler`.
 */
export function nettoyer(texte: string, jeton: string): string {
  let propre = texte

  for (const forme of new Set([jeton, jeton.trim(), encodeURIComponent(jeton.trim())])) {
    if (forme.length >= 8) propre = propre.split(forme).join(REMPLACEMENT)
  }

  return propre.replace(FORME_JETON, REMPLACEMENT)
}

/**
 * Une erreur qui peut sortir d’ici.
 *
 * ⛔ Pas de `cause` : l’erreur d’origine porte l’URL, donc le jeton.
 */
export class ErreurTelegram extends Error {
  override readonly name = 'ErreurTelegram'

  constructor(
    message: string,
    readonly statut: number | null,
  ) {
    super(message)
  }
}

/**
 * Coupe le corps pour que le message tienne, sans jamais couper le pied.
 *
 * ⚠️ Le pied, c’est le lien vers la fiche : un message tronqué qui a perdu son
 *    lien ne sert plus à rien. ⚠️ On ne coupe pas une paire de substitution —
 *    un émoji coupé en deux rend un caractère invalide.
 */
export function tronquer(corps: string, pied: string, max: number = LONGUEUR_MAX): string {
  const entier = pied === '' ? corps : `${corps}\n${pied}`
  if (entier.length <= max) return entier

  const place = Math.max(0, max - (pied === '' ? 1 : pied.length + 2))
  let coupe = corps.slice(0, place)

  const dernier = coupe.charCodeAt(coupe.length - 1)
  if (dernier >= 0xd800 && dernier <= 0xdbff) coupe = coupe.slice(0, -1)

  return pied === '' ? `${coupe}…` : `${coupe}…\n${pied}`
}

/**
 * L’avis d’une note — un pointeur.
 *
 * ⛔ Ce qu’il ne contient pas est la moitié de la règle : ni `titre`, ni
 *    `resume`, ni `citations`, ni `zone`, ni l’auteur, ni l’URL de la page où
 *    était la personne. `telegram.test.ts` les cherche un par un.
 */
export function composerAvis(retour: RetourANotifier): string {
  const type = retour.synthese.type as TypeRetour
  const lignes = [
    `Feedys · ${retour.produitNom}`,
    `Nouveau retour · ${LIBELLES_TYPE[type] ?? type}`,
  ]

  const quand = dateLisible(retour.contexte.recuLe, retour.contexte.fuseau)
  if (quand) lignes.push(quand)

  return tronquer(lignes.join('\n'), lienFiche(retour.urlPublique, retour.retourId))
}

interface ReponseTelegram {
  readonly ok?: unknown
  readonly description?: unknown
  readonly parameters?: { readonly retry_after?: unknown }
}

async function lire(reponse: { json(): Promise<unknown> }): Promise<ReponseTelegram> {
  try {
    const corps = await reponse.json()
    return typeof corps === 'object' && corps !== null ? (corps as ReponseTelegram) : {}
  } catch {
    return {}
  }
}

function description(corps: ReponseTelegram): string {
  return typeof corps.description === 'string' ? corps.description.slice(0, 200) : ''
}

/** Une raison lisible, dans les mots de l’exploitant. */
function raisonDe(statut: number, corps: ReponseTelegram): string {
  const detail = description(corps)
  const suite = detail ? ` — ${detail}` : ''

  if (statut === 401 || statut === 404) {
    return `Telegram refuse le jeton (${statut}) : FEEDYS_TELEGRAM_JETON est-il celui du bot ?${suite}`
  }
  if (statut === 403) {
    return `le bot ne peut pas écrire dans ce chat (403) : il a été bloqué, ou retiré du groupe${suite}`
  }
  if (statut === 400) {
    return `Telegram refuse le message (400) : FEEDYS_TELEGRAM_CHAT est-il le bon ?${suite}`
  }
  return `Telegram a répondu ${statut}${suite}`
}

function secondes(valeur: unknown): number | null {
  return typeof valeur === 'number' && Number.isFinite(valeur) && valeur >= 0 ? valeur : null
}

/**
 * Envoie un texte, ou lève une `ErreurTelegram` propre.
 *
 * ⚠️ 429 : on respecte `retry_after`, deux fois au plus, trente secondes au
 *    plus. 400, 401, 403 : échec immédiat, sans boucle — insister ne changera
 *    ni un chat introuvable, ni un bot bloqué.
 */
export async function envoyerTelegram(
  texte: string,
  reglages: ReglagesTelegram,
  ports: PortsTelegram,
): Promise<void> {
  const url = `https://api.telegram.org/bot${reglages.jeton.trim()}/sendMessage`
  const corps = JSON.stringify({
    chat_id: reglages.chat.trim(),
    text: tronquer(texte, ''),
    // ⚠️ Sinon les robots de Telegram vont chercher l’URL du back-office du client.
    link_preview_options: { is_disabled: true },
  })

  for (let tentative = 0; ; tentative += 1) {
    let reponse: Awaited<ReturnType<Recuperer>>

    try {
      reponse = await ports.fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: corps,
        signal: AbortSignal.timeout(ports.delaiMs ?? DELAI_TELEGRAM_MS),
      })
    } catch (erreur) {
      // ⛔ On ne garde QUE le message, nettoyé. Ni la pile, ni la cause : c’est
      //    là que `fetch` recopie l’URL.
      const nom = erreur instanceof Error ? erreur.name : ''
      const message = erreur instanceof Error ? erreur.message : String(erreur)
      const raison =
        nom === 'TimeoutError' || nom === 'AbortError'
          ? `Telegram n’a pas répondu en ${Math.round((ports.delaiMs ?? DELAI_TELEGRAM_MS) / 1000)} s`
          : `Telegram injoignable : ${message}`
      throw new ErreurTelegram(nettoyer(raison, reglages.jeton), null)
    }

    const lu = await lire(reponse)
    if (reponse.status === 200 && lu.ok === true) return

    if (reponse.status === 429) {
      const attente = secondes(lu.parameters?.retry_after) ?? 1
      if (tentative < TENTATIVES_429 && attente <= ATTENTE_MAX_S) {
        await ports.attendre(attente * 1000)
        continue
      }
      throw new ErreurTelegram(
        nettoyer(`Telegram limite le débit (429) : réessayer dans ${attente} s`, reglages.jeton),
        429,
      )
    }

    throw new ErreurTelegram(nettoyer(raisonDe(reponse.status, lu), reglages.jeton), reponse.status)
  }
}

/** Le canal, tel que `envoyer.ts` le parle. */
export function canalTelegram(reglages: ReglagesTelegram, ports: PortsTelegram): PortCanal {
  return {
    canal: 'telegram',
    destinataire: reglages.chat.trim(),
    envoyer: (retour) => envoyerTelegram(composerAvis(retour), reglages, ports),
  }
}

/**
 * Le message d’essai de la liste d’installation.
 *
 * ⚠️ Il ne dit rien d’autre que l’installation qui l’envoie : c’est ce qu’on
 *    veut vérifier sur le téléphone — que CE bot, pour CE client, arrive.
 */
export function composerEssai(installation: string): string {
  return [
    `Feedys · ${installation}`,
    'Message d’essai. Si vous le lisez, les avis de nouveaux retours et les alertes de cette installation arriveront ici.',
  ].join('\n')
}
