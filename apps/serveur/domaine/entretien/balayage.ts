/**
 * Le filet — ce qui referme les entretiens que le widget n’a pas refermés.
 *
 * ⚠️ POURQUOI IL EXISTE. La clôture d’un entretien dépend entièrement d’une
 *    requête du navigateur : `POST /fin`, à la fermeture du panneau ou sur
 *    `pagehide` avec `keepalive`. Un onglet tué, un poste éteint, un `keepalive`
 *    que le système laisse tomber — et le retour reste `en_cours` pour toujours :
 *    ni synthèse, ni email, et une ligne au back-office qui a l’air d’un
 *    entretien en cours ([03-Bugs/BUGS_LOG.md] 003, T-006).
 *
 * ⛔ CE N’EST PAS UNE PERTE DE PAROLE. Elle est en base depuis l’ingestion,
 *    lisible au back-office et par MCP. C’est la NOTE qui manque — moins grave,
 *    et quand même contraire à la promesse.
 *
 * ⚠️ CETTE PHRASE A ÉTÉ FAUSSE, et elle a coûté une relecture. Le filet referme
 *    un entretien dont le panneau est peut-être RESTÉ OUVERT : ce que la
 *    personne écrit ensuite arrive sur un retour clos. `domaine/entretien/tour.ts`
 *    écrit désormais ces mots-là AVANT de regarder le statut — sans quoi la
 *    fermeture ici jetait une phrase là-bas, en répondant « C’est parti. ».
 *
 * ⛔ CE MODULE NE SYNTHÉTISE PAS. Il referme, puis il passe la main au CHEMIN
 *    ORDINAIRE — le même port `aval` que `terminerEntretien`. Une seconde
 *    implémentation de la synthèse divergerait de la première le jour où l’une
 *    des deux bouge, et personne ne le verrait avant de lire une note manquante.
 */

/**
 * N — le silence au-delà duquel un entretien est réputé mort.
 *
 * **Trente minutes**, et ce n’est pas une mesure : c’est un choix, faute de
 * données ([D-018](../../../../00-Projet/DECISIONS_LOG.md)). Le seul chiffre
 * qu’on ait vraiment est celui d’en face — quand le chemin nominal marche, la
 * clôture arrive **en huit secondes au pire** après le dernier message. N est
 * donc à deux ordres de grandeur au-dessus du signal normal : il ne peut pas
 * couper quelqu’un qui réfléchit.
 *
 * ⚠️ Trop court, on coupe la parole de quelqu’un qui cherche ses mots ; trop
 *    long, la note arrive le lendemain.
 */
export const SILENCE_AVANT_CLOTURE_MS = 30 * 60 * 1000

/**
 * Le pas du balayage.
 *
 * ⚠️ Cinq minutes : un retour muet est donc refermé entre N et N + 5 minutes.
 *    Un pas plus court n’achèterait rien — personne n’attend cette note à la
 *    minute — et réveillerait la base pour rien.
 */
export const PAS_BALAYAGE_MS = 5 * 60 * 1000

/**
 * ⛔ Une passe est bornée. Un balayage ne doit jamais devenir un long travail :
 *    il tourne dans le processus qui sert les requêtes, et une synthèse appelle
 *    le modèle. Ce qui dépasse attend la passe suivante, cinq minutes plus tard.
 */
export const PAR_PASSE = 20

/**
 * ⛔ ET UNE PASSE EST BORNÉE EN TEMPS, PAS SEULEMENT EN NOMBRE. `PAR_PASSE` seul
 *    ne borne rien : une synthèse porte `AbortSignal.timeout(60 s)` **et**
 *    `maxRetries: 2`, soit trois minutes de pire cas POUR UN SEUL retour. Vingt
 *    lents faisaient une passe d’une heure, pendant laquelle le verrou
 *    `enCours` de `infra/filet.ts` faisait sauter les onze ticks suivants.
 *
 * ⚠️ Trois minutes : on n’entame pas un nouvel aval au-delà. Ce qui reste est
 *    déjà refermé et déjà journalisé — il sera repris par la requête de
 *    rattrapage (04-Architecture/hebergement.md §Le filet), pas par une passe
 *    suivante : `clore` ne regarde que les `en_cours`.
 */
export const BUDGET_PASSE_MS = 3 * 60 * 1000

/**
 * ⚠️ La règle, énoncée pour UN retour. Le SQL, lui, ne la réécrit pas : il
 *    reçoit l’instant limite calculé par `instantLimite` et compare. C’est ce
 *    qui évite d’avoir la même règle à deux endroits, dont l’un en chaîne de
 *    caractères — `balayage.test.ts` prouve que les deux formes s’accordent.
 *
 * Le « dernier signe de vie » est la date du dernier message ; un retour qui
 * n’en a aucun est jugé sur sa création.
 */
export function estMuet(
  dernierSigneLe: Date,
  maintenant: Date,
  silenceAvantMs: number = SILENCE_AVANT_CLOTURE_MS,
): boolean {
  return dernierSigneLe.getTime() < instantLimite(maintenant, silenceAvantMs).getTime()
}

/** L’instant avant lequel un dernier signe de vie vaut « muet ». */
export function instantLimite(
  maintenant: Date,
  silenceAvantMs: number = SILENCE_AVANT_CLOTURE_MS,
): Date {
  return new Date(maintenant.getTime() - silenceAvantMs)
}

export interface PortsBalayage {
  /**
   * Referme les entretiens muets **et** les journalise, d’une seule transaction,
   * puis rend les identifiants de ceux que CET appel a réellement refermés.
   *
   * ⛔ C’est la réservation. Deux conteneurs qui balaient en même temps ne
   *    doivent pas synthétiser deux fois le même retour : c’est l’`UPDATE` qui
   *    tranche, pas une lecture suivie d’une écriture.
   */
  clore(avant: Date, limite: number): Promise<string[]>

  /**
   * Le chemin ordinaire — celui de `terminerEntretien`. Synthèse, puis email.
   */
  aval(retourId: string): Promise<void>

  signaler?(quoi: string, erreur: unknown): void
}

export interface OptionsBalayage {
  maintenant?: Date
  silenceAvantMs?: number
  parPasse?: number
  budgetMs?: number
  /** ⚠️ L’horloge du BUDGET, distincte de `maintenant` qui date le silence. */
  horloge?: () => number
}

export interface BilanBalayage {
  /** Refermés par cette passe. */
  clos: number
  /**
   * Refermés dont l’aval n’a pas jeté.
   *
   * ⛔ CE N’EST PAS « dont une note a été écrite ». `synthetiser` retourne sans
   *    rien faire sur `deja_faite` et sur `rien_a_synthetiser` — ce dernier
   *    étant le cas réel du retour dicté sans transcript. Une ligne
   *    « 20 refermé(s), 20 synthétisé(s), 0 en échec » peut donc correspondre à
   *    zéro note. Le compte des notes se prend en base, pas ici.
   */
  synthetises: number
  /** Refermés, mais dont l’aval a échoué. ⚠️ Le retour n’est pas perdu. */
  echoues: number
  /**
   * Refermés, dont l’aval n’a pas été entamé faute de temps.
   *
   * ⛔ Ils ne reviendront PAS d’eux-mêmes : ils sont déjà `abandonne`, et
   *    `clore` ne regarde que les `en_cours`. C’est la requête de rattrapage qui
   *    les retrouve (04-Architecture/hebergement.md §Le filet). Une valeur non
   *    nulle ici est un signal d’exploitation, pas une statistique.
   */
  reportes: number
}

/**
 * Une passe.
 *
 * ⚠️ L’aval est joué **en série**, pas en parallèle : chaque synthèse appelle le
 *    modèle, et vingt appels simultanés depuis le processus qui sert les
 *    requêtes est exactement ce qu’on ne veut pas.
 *
 * ⛔ UN ÉCHEC NE BLOQUE PAS LES SUIVANTS, et ne laisse pas le retour dans un
 *    état intermédiaire : il est déjà `abandonne`, ce qui est terminal. Il lui
 *    manque sa note, exactement comme à un `POST /fin` dont la synthèse a
 *    échoué — `terminerEntretien` avale la même erreur pour la même raison.
 */
export async function balayer(
  ports: PortsBalayage,
  options: OptionsBalayage = {},
): Promise<BilanBalayage> {
  const maintenant = options.maintenant ?? new Date()
  const silence = options.silenceAvantMs ?? SILENCE_AVANT_CLOTURE_MS
  const limite = options.parPasse ?? PAR_PASSE
  const budget = options.budgetMs ?? BUDGET_PASSE_MS
  const horloge = options.horloge ?? (() => Date.now())

  const debut = horloge()
  const clos = await ports.clore(instantLimite(maintenant, silence), limite)
  const bilan: BilanBalayage = { clos: clos.length, synthetises: 0, echoues: 0, reportes: 0 }

  for (const retourId of clos) {
    // ⛔ On n’ENTAME pas un aval au-delà du budget — on n’interrompt jamais
    //    celui qui tourne : une synthèse coupée au milieu coûterait le jeton
    //    sans écrire la note.
    if (horloge() - debut >= budget) {
      bilan.reportes += 1
      continue
    }

    try {
      await ports.aval(retourId)
      bilan.synthetises += 1
    } catch (erreur) {
      bilan.echoues += 1
      // ⚠️ L’IDENTIFIANT EST DANS LE MESSAGE. Sans lui, les journaux disaient
      //    qu’une note avait manqué sans dire laquelle, et le retour est
      //    terminal : aucune passe ne le reprendra. Un cuid n’est pas de la
      //    parole — la règle « jamais le corps d’un retour » n’est pas en cause.
      ports.signaler?.(`balayage — aval de ${retourId} (refermé par silence)`, erreur)
    }
  }

  if (bilan.reportes > 0) {
    ports.signaler?.(
      `balayage — ${bilan.reportes} entretien(s) refermé(s) sans note, budget de passe épuisé`,
      new Error('budget de passe épuisé — rattrapage : hebergement.md §Le filet'),
    )
  }

  return bilan
}
