/**
 * Les échecs du modèle — le seul seuil technique de hebergement.md §Ce qui doit
 * être surveillé.
 *
 * ⚠️ EN MÉMOIRE, ET C’EST DÉLIBÉRÉ. Ce qu’on veut savoir, c’est si le modèle
 *    échoue MAINTENANT ; une heure d’appels suffit, et un redémarrage qui
 *    l’oublie ne ment pas — il rend « inconnu » jusqu’à ce que de nouveaux
 *    appels parlent. Ce qui doit survivre au redémarrage, c’est l’INCIDENT, et
 *    lui vit en base (`alertes`).
 *
 * ⛔ CE N’EST PAS UN COMPTEUR DE CONSOMMATION. [D-029] refuse un compteur de
 *    jetons applicatif, qui divergerait de la facture ; celui-ci ne compte que
 *    des réussites et des échecs, ne les écrit nulle part, et ne coupe jamais
 *    un appel.
 *
 * ⛔ Il ne remplace pas `modele.ts` comme point d’appel unique : il enveloppe
 *    le port, il n’appelle aucun fournisseur.
 */
import type { Modele } from '../entretien/modele'

/** La fenêtre : une heure. */
export const FENETRE_MODELE_MS = 60 * 60 * 1000

/**
 * ⚠️ Vingt appels avant de parler en pourcentage : à trois appels, un seul échec
 *    fait 33 %, et l’alerte ne voudrait rien dire.
 */
export const MINIMUM_APPELS = 20

/** hebergement.md : « alerte au-delà de 5 % ». */
export const TAUX_ALERTE = 0.05

/**
 * ⚠️ L’hystérésis : un incident ne se referme que franchement sous le seuil.
 *    Sans elle, un taux qui oscille autour de 5 % ouvrirait et refermerait
 *    l’incident à chaque passe — une alerte par passe, par un autre chemin.
 */
export const TAUX_RETABLI = 0.02

/**
 * ⛔ La panne franche n’attend pas vingt appels. Une clé révoquée, un plafond
 *    atteint : sur un produit qu’une dizaine de personnes utilisent, vingt
 *    appels peuvent prendre une journée. Trois échecs sans une seule réussite
 *    suffisent à dire que le modèle ne répond plus.
 */
export const ECHECS_FRANCS = 3

/** Rétabli : les derniers appels ont tous réussi. */
export const REUSSITES_RETABLI = 5

export interface AppelModele {
  readonly instant: number
  readonly ok: boolean
}

export type EtatModele = {
  readonly etat: 'en_echec' | 'sain' | 'inconnu'
  readonly appels: number
  readonly echecs: number
}

/** La décision, sur une liste d’appels. ⚠️ Pure : `modele.test.ts` la tient. */
export function etatModele(appels: readonly AppelModele[], maintenant: number): EtatModele {
  const recents = appels.filter((appel) => maintenant - appel.instant <= FENETRE_MODELE_MS)
  const echecs = recents.filter((appel) => !appel.ok).length
  const n = recents.length
  const bilan = { appels: n, echecs }

  if (n === 0) return { etat: 'inconnu', ...bilan }

  if ((n >= MINIMUM_APPELS && echecs / n > TAUX_ALERTE) || (echecs >= ECHECS_FRANCS && echecs === n)) {
    return { etat: 'en_echec', ...bilan }
  }

  const derniers = recents.slice(-REUSSITES_RETABLI)
  const derniersReussis = derniers.every((appel) => appel.ok)

  if (derniersReussis && (n < MINIMUM_APPELS || echecs / n <= TAUX_RETABLI)) {
    return { etat: 'sain', ...bilan }
  }

  return { etat: 'inconnu', ...bilan }
}

export interface FenetreModele {
  noter(ok: boolean): void
  etat(): EtatModele
}

/**
 * ⚠️ Bornée en nombre autant qu’en temps : un pic d’appels ne fait pas grossir
 *    la mémoire du processus. Mille appels par heure, c’est cent fois l’usage
 *    prévu.
 */
const TAILLE_MAX = 1000

export function creerFenetreModele(horloge: () => number = () => Date.now()): FenetreModele {
  let appels: AppelModele[] = []

  return {
    noter(ok) {
      const maintenant = horloge()
      appels.push({ instant: maintenant, ok })
      appels = appels
        .filter((appel) => maintenant - appel.instant <= FENETRE_MODELE_MS)
        .slice(-TAILLE_MAX)
    },
    etat() {
      return etatModele(appels, horloge())
    },
  }
}

/**
 * Le port du modèle, qui note chaque appel.
 *
 * ⛔ L’erreur est notée PUIS relancée, telle quelle : mesurer ne change rien à
 *    ce que l’appelant reçoit.
 */
export function mesurerModele(modele: Modele, fenetre: FenetreModele): Modele {
  async function mesurer<T>(appel: () => Promise<T>): Promise<T> {
    try {
      const resultat = await appel()
      fenetre.noter(true)
      return resultat
    } catch (erreur) {
      fenetre.noter(false)
      throw erreur
    }
  }

  return {
    identifiant: modele.identifiant,
    tour: (demande) => mesurer(() => modele.tour(demande)),
    synthese: (demande) => mesurer(() => modele.synthese(demande)),
  }
}
