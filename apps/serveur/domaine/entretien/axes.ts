/**
 * Les axes fermés — ce que le SERVEUR en écrit.
 *
 * ⛔ LE MODÈLE DÉCIDE *QUAND*, CE FICHIER DÉCIDE *QUOI*. C’est la découpe de
 *    [D-025](../../../../00-Projet/DECISIONS_LOG.md), et c’est déjà celle de
 *    `RELANCE_INAUDIBLE` — « écrite ici et pas demandée au modèle ».
 *
 *    Un modèle qui rédigerait lui-même « Systématique » ferait entrer sa propre
 *    prose dans le fil en ligne `collaborateur` ; le développeur la lirait
 *    ensuite entre guillemets dans la note, comme si la personne l’avait
 *    prononcée. C’est exactement le défaut que P-025 vient de fermer
 *    ([BUGS_LOG](../../../../03-Bugs/BUGS_LOG.md) 016), et le rouvrir par la
 *    porte d’à côté n’aurait aucun sens.
 *
 * ⛔ CES LIBELLÉS-CI NE SONT PAS CEUX DES BOUTONS. Le widget écrit les siens,
 *    côté MIT (`ui/textes.ts`) ; ceux-ci ne servent qu’à la ligne du fil, que le
 *    modèle relit. Les deux n’ont aucune raison d’être identiques, et rien ne
 *    les fait traverser la frontière : seule la VALEUR voyage.
 *
 * ⛔ Module pur : ni base, ni réseau, ni horloge.
 */
import type { Axe, ValeurAxe } from '../../../../packages/widget/src/contrat'
import { VALEURS_AXE, valeurDAxe } from '../../../../packages/widget/src/transport'

export type { Axe, ValeurAxe }

/** Le nom de l’axe, tel qu’il apparaît dans le fil. */
const LIBELLES_AXE: Readonly<Record<Axe, string>> = {
  recurrence: 'Récurrence',
  ampleur: 'Ampleur',
}

/**
 * La valeur, en français, pour la ligne du fil.
 *
 * ⚠️ Rédigés pour être RELUS PAR LE MODÈLE dans un fil de conversation, pas
 *    pour être cliqués. « à chaque fois » se lit à la suite de la question ;
 *    le bouton, lui, dit « À chaque fois » et c’est le widget qui l’écrit.
 */
const LIBELLES_VALEUR: Readonly<Record<ValeurAxe, string>> = {
  premiere_fois: 'la première fois',
  deja_vu: 'déjà vu',
  systematique: 'à chaque fois',
  bloque: 'ça bloque',
  ralentit: 'ça ralentit',
  agace: 'ça agace',
}

/**
 * La ligne de fil d’une réponse d’un clic.
 *
 * ⛔ Préfixée `Réponse · `, comme les corrections le sont par `Correction · `.
 *    ⚠️ Le préfixe est pour l’ŒIL — le modèle, le back-office, MCP. Ce qui fait
 *    foi pour la machine est la colonne `geste`, jamais ce texte : reconnaître
 *    un geste à son préfixe se casserait le jour où quelqu’un dicte « réponse ».
 */
export function ligneDeFil(axe: Axe, valeur: ValeurAxe): string {
  return `Réponse · ${LIBELLES_AXE[axe]} — ${LIBELLES_VALEUR[valeur]}`
}

/**
 * La valeur reçue est-elle bien l’une de celles de cet axe ?
 *
 * ⚠️ Redit ici ce que le contrat vérifie déjà, et ce n’est pas une redite
 *    inutile : le domaine ne suppose jamais qu’une route l’a validé avant lui
 *    (04-Architecture/architecture.md §Sécurité). `entretien:rejouer` et les
 *    tests entrent d’ailleurs par le domaine, sans passer par la route.
 */
export function reponseValide(axe: string | undefined, valeur: string | undefined): boolean {
  if (axe === undefined || valeur === undefined) return false
  return valeurDAxe(axe, valeur)
}

/** Les valeurs d’un axe, pour qui doit les énumérer. */
export function valeursDe(axe: Axe): readonly ValeurAxe[] {
  return VALEURS_AXE[axe]
}
