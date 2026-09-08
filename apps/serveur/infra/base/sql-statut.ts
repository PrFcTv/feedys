/**
 * Le SQL du changement de statut, partagé par le back-office et par le MCP.
 *
 * ⚠️ Les deux chemins écrivent EXACTEMENT la même chose. Les avoir laissés en
 *    double, c’était garantir qu’un jour l’un des deux dérive — et que le
 *    collaborateur reçoive deux comportements selon qui a marqué son retour.
 *
 * ⛔ L’invariant qui justifie ce fichier : une réponse ne se re-notifie pas
 *    toute seule et ne s’efface pas toute seule
 *    (01-Specs/retour-au-collaborateur.md).
 *
 *    - reposer le même statut avec le même mot ne réveille personne : celui qui
 *      a déjà cliqué « J’ai vu » ne revoit pas la carte ;
 *    - marquer sans fournir de mot ne détruit pas celui qui était déjà parti ;
 *    - un mot vraiment nouveau, lui, redéclenche la notification.
 */

/** ⚠️ `lu` ne notifie personne : il ne touche à aucune colonne de réponse. */
export const POSER_STATUT_SEUL = `
  update retours set statut = $2::statut_retour, maj_le = now() where id = $1
`

/**
 * `traite` / `ecarte` SANS mot fourni.
 *
 * ⚠️ `coalesce` plutôt qu’un `now()` sec : si une notification est déjà partie,
 *    son horodatage et son accusé de lecture restent où ils sont.
 */
export const POSER_STATUT_SANS_MOT = `
  update retours
     set statut = $2::statut_retour,
         reponse_envoyee_le = coalesce(reponse_envoyee_le, now()),
         maj_le = now()
   where id = $1
`

/**
 * `traite` / `ecarte` AVEC un mot fourni — `$3` valant `null` quand on efface
 * délibérément.
 *
 * ⚠️ `is distinct from` et non `<>` : `<>` rend `null` dès qu’un côté l’est, et
 *    le cas « rien avant, un mot maintenant » retomberait dans le `else`.
 */
export const POSER_STATUT_AVEC_MOT = `
  update retours
     set statut = $2::statut_retour,
         reponse_texte = $3,
         reponse_envoyee_le = case
           when reponse_envoyee_le is null or $3 is distinct from reponse_texte then now()
           else reponse_envoyee_le
         end,
         reponse_lue_le = case
           when reponse_envoyee_le is null or $3 is distinct from reponse_texte then null
           else reponse_lue_le
         end,
         maj_le = now()
   where id = $1
`

/** Les statuts qui adressent un accusé au collaborateur. `lu` reste interne. */
export function notifieLeCollaborateur(statut: string): boolean {
  return statut === 'traite' || statut === 'ecarte'
}

/**
 * Ce qu’il faut écrire pour un changement de statut donné.
 *
 * ⚠️ `reponse` vaut `undefined` quand l’appelant n’y a pas touché — le MCP qui
 *    ne passe pas le champ — et une chaîne quand il l’a fourni, VIDE COMPRISE,
 *    ce qui veut dire « efface ce mot ». Les deux ne s’écrivent pas pareil, et
 *    les confondre était le défaut : marquer deux fois effaçait le message.
 */
export function ecritureStatut(
  statut: string,
  reponse: string | undefined,
): { readonly sql: string; readonly parametres: readonly unknown[]; readonly mot: string | null } {
  if (!notifieLeCollaborateur(statut)) {
    return { sql: POSER_STATUT_SEUL, parametres: [statut], mot: null }
  }

  if (reponse === undefined) {
    return { sql: POSER_STATUT_SANS_MOT, parametres: [statut], mot: null }
  }

  const mot = reponse.trim() || null
  return { sql: POSER_STATUT_AVEC_MOT, parametres: [statut, mot], mot }
}
