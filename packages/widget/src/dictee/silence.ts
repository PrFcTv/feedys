/**
 * L’arrêt sur silence du mode mains libres — deux secondes.
 *
 * ⛔ CE N’EST PAS `@ricky0123/vad`, ET C’EST UNE DÉCISION MESURÉE : voir [D-012]
 *    dans 00-Projet/DECISIONS_LOG.md. La chaîne Silero minimale pèse 5,3 Mo
 *    gzip — 3,4 pour le runtime ONNX, 1,9 pour le modèle — contre 14 Ko pour le
 *    widget entier. Et elle se télécharge à l’instant précis où quelqu’un vient
 *    de cliquer pour parler : il parlerait pendant le chargement, et on perdrait
 *    ce qu’il dit. C’est l’alternative que [T-001] avait déjà prévue.
 *
 * ⛔ CE N’EST PAS NON PLUS UN SEUIL FIXE. Un seuil absolu tient dans un bureau
 *    silencieux et échoue exactement là où le produit vit : en open space, où le
 *    bruit de fond passerait pour de la parole et où l’arrêt n’arriverait jamais.
 *    Le plancher est donc MESURÉ sur les premières centaines de millisecondes,
 *    puis suivi lentement.
 *
 * ⚠️ Le biais est assumé : on préfère ne pas s’arrêter que s’arrêter trop tôt.
 *    Un arrêt manqué coûte un clic — le second clic est visible en permanence.
 *    Un arrêt prématuré coupe quelqu’un au milieu d’une phrase, et il ne
 *    recommencera pas.
 *
 * ⛔ Fonction pure, sans minuterie : elle reçoit le niveau et l’horodatage, et
 *    rend un verdict. C’est ce qui la rend testable sans attendre deux secondes.
 */

export interface OptionsGuet {
  /** La durée de silence qui déclenche l’arrêt. */
  readonly apresMs?: number
  /** Le temps d’écoute du bruit de fond avant de juger quoi que ce soit. */
  readonly calibrageMs?: number
}

export interface Guet {
  /**
   * Rend `true` la première fois que le silence a duré assez longtemps.
   *
   * ⚠️ Une seule fois : le guet se désarme après avoir parlé, pour qu’une boucle
   *    de rendu qui continue de l’appeler ne déclenche pas dix arrêts.
   */
  observer(niveau: number, horodatage: number): boolean
  /** Du son a-t-il été entendu depuis le début ? Sert à l’affichage. */
  aEntenduDuSon(): boolean
}

/** Deux secondes de silence. C’est la spécification, pas un réglage. */
const APRES_MS = 2_000

/**
 * ⚠️ 400 ms de calibrage : assez pour mesurer une pièce, assez court pour que
 *    personne ne le remarque. Pendant ce temps, aucun arrêt n’est possible.
 */
const CALIBRAGE_MS = 400

/**
 * Le plancher vaut le bruit de fond mesuré, multiplié par ceci, plus une marge.
 * ⚠️ Réglé large exprès — voir le biais assumé en tête de fichier.
 */
const FACTEUR_PLANCHER = 2.2
const MARGE_PLANCHER = 0.012

/** ⚠️ Le plancher redescend lentement si la pièce se calme. Jamais il ne monte. */
const DESCENTE = 0.02

export function guetterSilence(options: OptionsGuet = {}): Guet {
  const apresMs = options.apresMs ?? APRES_MS
  const calibrageMs = options.calibrageMs ?? CALIBRAGE_MS

  let debut: number | undefined
  let sommeCalibrage = 0
  let mesuresCalibrage = 0
  let plancher: number | undefined
  let dernierSon: number | undefined
  let duSon = false
  let dit = false

  return {
    aEntenduDuSon: () => duSon,

    observer(niveau, horodatage) {
      debut ??= horodatage

      if (horodatage - debut < calibrageMs) {
        sommeCalibrage += niveau
        mesuresCalibrage += 1
        return false
      }

      if (plancher === undefined) {
        const fond = mesuresCalibrage === 0 ? 0 : sommeCalibrage / mesuresCalibrage
        plancher = fond * FACTEUR_PLANCHER + MARGE_PLANCHER
        dernierSon = horodatage
      }

      if (niveau > plancher) {
        duSon = true
        dernierSon = horodatage
        return false
      }

      // La pièce s’est calmée : on suit, doucement, et seulement vers le bas.
      plancher = plancher * (1 - DESCENTE) + (niveau * FACTEUR_PLANCHER + MARGE_PLANCHER) * DESCENTE

      if (dit || dernierSon === undefined) return false
      // ⛔ On n’arrête pas quelqu’un qui n’a pas encore parlé : il cherche ses
      //    mots, et deux secondes de réflexion sont ordinaires.
      if (!duSon) return false

      if (horodatage - dernierSon >= apresMs) {
        dit = true
        return true
      }

      return false
    },
  }
}
