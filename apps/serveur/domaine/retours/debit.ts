/**
 * La limitation de débit.
 *
 * ⚠️ Ce qu’elle protège, et ce qu’elle ne protège pas. La clé publique est dans
 *    le HTML de l’hôte : n’importe qui peut poster. C’est **accepté par
 *    conception** (04-Architecture/architecture.md §Sécurité). Le pire cas visé
 *    n’est donc pas la fuite, c’est le bruit — et une base qu’on remplit plus
 *    vite qu’on ne la lit.
 *
 * ⚠️ En mémoire, et volontairement. Un conteneur, un Postgres, pas de Redis :
 *    ajouter un composant à exploiter pour quelques dizaines de retours par jour
 *    serait un mauvais échange (§Ce qui est délibérément absent). Un redémarrage
 *    remet les compteurs à zéro, et ce n’est pas grave.
 *
 * ⛔ Pur : l’horloge entre en argument. C’est ce qui rend la fenêtre testable
 *    sans attendre une minute.
 */

/** Une fenêtre glissante : au plus `max` passages par `fenetreMs`. */
export class Limiteur {
  readonly #max: number
  readonly #fenetreMs: number
  readonly #passages = new Map<string, number[]>()

  /**
   * ⚠️ `maxCles` n’est pas un réglage de confort : sans lui, une clé forgée
   *    différemment à chaque requête ferait grossir la carte sans fin. Au-delà,
   *    on balaie ce qui a expiré.
   */
  readonly #maxCles: number

  constructor(max: number, fenetreMs: number, maxCles = 10_000) {
    this.#max = max
    this.#fenetreMs = fenetreMs
    this.#maxCles = maxCles
  }

  /** Enregistre un passage et dit s’il est autorisé. */
  autoriser(cle: string, maintenant: number): boolean {
    const depuis = maintenant - this.#fenetreMs
    const recents = (this.#passages.get(cle) ?? []).filter((t) => t > depuis)

    if (recents.length >= this.#max) {
      this.#passages.set(cle, recents)
      return false
    }

    recents.push(maintenant)
    this.#passages.set(cle, recents)

    if (this.#passages.size > this.#maxCles) this.#balayer(depuis)

    return true
  }

  #balayer(depuis: number): void {
    for (const [cle, passages] of this.#passages) {
      const recents = passages.filter((t) => t > depuis)
      if (recents.length === 0) this.#passages.delete(cle)
      else this.#passages.set(cle, recents)
    }
  }
}

/**
 * Les deux compteurs de l’ingestion.
 *
 * Par clé **et** par IP, parce qu’ils n’attrapent pas la même chose : la clé
 * borne un produit qui s’emballe, l’IP borne quelqu’un qui s’amuse avec une clé
 * publique trouvée dans un HTML.
 */
export const DEBIT = {
  parCle: { max: 60, fenetreMs: 60_000 },
  parIp: { max: 20, fenetreMs: 60_000 },
} as const

export interface PortDebit {
  /** `false` = trop de passages. Enregistre le passage au passage. */
  autoriser(cle: string, maintenant: number): boolean
}

/** Les deux limiteurs de l’ingestion, tenus ensemble. */
export function creerDebitIngestion(): {
  cle: PortDebit
  ip: PortDebit
} {
  return {
    cle: new Limiteur(DEBIT.parCle.max, DEBIT.parCle.fenetreMs),
    ip: new Limiteur(DEBIT.parIp.max, DEBIT.parIp.fenetreMs),
  }
}
