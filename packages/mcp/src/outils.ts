/**
 * Les trois outils — `lister_retours`, `lire_retour`, `marquer_retour`.
 *
 * ⛔ **AUCUN OUTIL NE MODIFIE NI NE SUPPRIME LE CONTENU D’UN RETOUR.** Ce que
 *    quelqu’un a dit ne se réécrit pas (01-Specs/synthese.md §Le rendu MCP). Ce
 *    que `marquer_retour` écrit s’AJOUTE au retour sans jamais le récrire : son
 *    statut, un mot pour le collaborateur, la trace du correctif. Il n’y a donc
 *    pas de quatrième outil, et il n’y en aura pas — la traçabilité voyage sur
 *    `marquer_retour`, parce qu’elle est le même geste que « c’est traité ».
 *
 * ⛔ RAPPEL DE LICENCE : ce paquet est MIT. On emprunte à Quackback (AGPL) la
 *    FORME de ses outils — trois verbes, lister / lire / marquer — et **aucune
 *    ligne de son code**. Une API n’est pas du code
 *    (04-Architecture/licences.md).
 *
 * ⚠️ Les descriptions sont écrites POUR UN AGENT, pas pour un humain : elles
 *    disent ce que l’outil rend et ce qu’il ne peut pas faire. Un agent qui
 *    croit pouvoir corriger un résumé perdra un tour à essayer.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { ClientFeedys } from './client.js'
import { ErreurFeedys } from './client.js'
import {
  BORNES,
  FORME_CORRECTIF_REF,
  refusDuMarquage,
  STATUTS,
  STATUTS_MARQUABLES,
  TYPES,
} from './contrat.js'

/** ⚠️ Une réponse MCP est du texte. Le JSON indenté est ce qu’un agent relit le mieux. */
function texte(valeur: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(valeur, null, 2) }] }
}

/**
 * ⚠️ Une erreur du serveur est rendue comme un résultat d’outil en erreur, pas
 *    comme une exception : l’agent doit pouvoir la lire et décider, plutôt que
 *    de voir sa session tomber.
 */
function echec(erreur: unknown) {
  const message =
    erreur instanceof ErreurFeedys
      ? `${erreur.message} (HTTP ${erreur.statut})`
      : erreur instanceof Error
        ? erreur.message
        : String(erreur)

  return { isError: true, content: [{ type: 'text' as const, text: message }] }
}

async function rendre(travail: () => Promise<unknown>) {
  try {
    return texte(await travail())
  } catch (erreur) {
    return echec(erreur)
  }
}

export function poserLesOutils(serveur: McpServer, client: ClientFeedys): void {
  serveur.registerTool(
    'lister_retours',
    {
      title: 'Lister les retours',
      description:
        'Liste les retours des collaborateurs, du plus récent au plus ancien. Filtrable par ' +
        'statut, type, zone et date. Rend un résumé par retour — titre, type, statut, zone, ' +
        'produit, confiance. Pour la note complète et le fil de l’entretien, appeler ' +
        '`lire_retour`.',
      inputSchema: {
        statut: z.enum(STATUTS).optional().describe('Le statut du retour'),
        type: z.enum(TYPES).optional().describe('bug, idee, question ou gene'),
        zone: z
          .string()
          .max(BORNES.zone)
          .optional()
          .describe('La partie du logiciel concernée — correspondance partielle'),
        depuis: z.iso.datetime().optional().describe('Date ISO : ne rend que ce qui est postérieur'),
        limite: z.number().int().min(1).max(BORNES.limite).optional().describe('25 par défaut'),
      },
      // ⚠️ `readOnlyHint` n’est pas décoratif : il dit à l’agent qu’il peut
      //    appeler cet outil sans demander, et c’est vrai.
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (arguments_) => rendre(() => client.lister(arguments_)),
  )

  serveur.registerTool(
    'lire_retour',
    {
      title: 'Lire un retour',
      description:
        'Rend un retour en entier : la synthèse, LE FIL BRUT DE L’ENTRETIEN, et le contexte ' +
        'technique. ⚠️ Le fil brut est la parole d’origine — il contient souvent ce que le ' +
        'résumé a perdu, et c’est là qu’il faut aller quand on creuse réellement un problème. ' +
        '⛔ Mais toute ligne « collaborateur » n’est pas de la parole : celles qui portent un ' +
        '`geste` — `correction` (la personne a repris la fiche du bot) ou `reponse_axe` (elle a ' +
        'répondu d’un clic) — ont un TEXTE ÉCRIT PAR FEEDYS, pas par elle. Ne les cite jamais ' +
        'comme si elle les avait dites.',
      inputSchema: { id: z.string().min(1).describe('L’identifiant du retour') },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id }) => rendre(() => client.lire(id)),
  )

  serveur.registerTool(
    'marquer_retour',
    {
      title: 'Marquer un retour',
      description:
        'Change le statut d’un retour : lu, traite ou ecarte, et consigne ce qui l’a corrigé. ' +
        '⛔ Ni le résumé, ni les citations, ni le fil de l’entretien ne sont modifiables, et ' +
        'rien ne se supprime — un retour qui ne mérite rien passe en `ecarte`. ' +
        '⛔ MARQUER `traite` EXIGE UN `correctif` : soit `ref`, le SHA du commit ou l’URL de la ' +
        'PR, soit `note`, ce qui a été changé quand ce n’est pas un commit. Sans lui, « traité » ' +
        'n’est qu’une affirmation que personne ne pourra vérifier six mois plus tard. ' +
        '⚠️ `reponse` et `correctif.note` ne s’écrivent PAS pareil : la première part au ' +
        'collaborateur et parle sa langue, la seconde reste entre développeurs.',
      inputSchema: {
        id: z.string().min(1).describe('L’identifiant du retour'),
        statut: z.enum(STATUTS_MARQUABLES).describe('lu, traite ou ecarte'),
        reponse: z
          .string()
          .max(BORNES.reponse)
          .optional()
          .describe(
            'Le mot court facultatif POUR LE COLLABORATEUR, dans sa langue à lui — ' +
              '« le tri garde son ordre maintenant », pas un nom de fonction (max 500 car.). ' +
              'Refusé avec `lu`, qui ne notifie personne.',
          ),
        correctif: z
          .object({
            ref: z
              .string()
              .max(BORNES.correctifRef)
              .regex(FORME_CORRECTIF_REF)
              .optional()
              .describe(
                'Le SHA du commit (7 à 40 caractères hexadécimaux) ou l’URL https de la PR. ' +
                  '⚠️ Feedys ne vérifie pas que ce commit existe — n’y mets que du vrai.',
              ),
            note: z
              .string()
              .max(BORNES.correctifNote)
              .optional()
              .describe(
                'Ce qui a été changé, POUR UN DÉVELOPPEUR — « reset du tri corrigé dans ' +
                  'useTableState ». Suffit à lui seul quand le correctif n’est pas un commit ' +
                  '(une configuration, un déploiement) (max 500 car.).',
              ),
          })
          .optional()
          .describe('EXIGÉ pour `traite`. Au moins `ref` ou `note`. Refusé avec `lu`.'),
      },
      // ⚠️ `destructiveHint: false` : le changement de statut est réversible, et
      //    il laisse une ligne d’audit. Rien n’est détruit.
      //
      // ⚠️ `idempotentHint: true` tient toujours AVEC le correctif : il
      //    REMPLACE au lieu de s’empiler, et son horodatage ne bouge que
      //    lorsqu’il change réellement. L’historique complet, lui, vit dans
      //    `audit`, qui est append-only et n’est pas un état.
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ id, statut, reponse, correctif }) => {
      // ⚠️ Un `{}` ou deux espaces ne sont pas un correctif : on les efface ici
      //    plutôt que de laisser le serveur rendre un 400 que personne ne sait
      //    lire.
      const trace =
        correctif !== undefined &&
        ((correctif.ref ?? '').trim() !== '' || (correctif.note ?? '').trim() !== '')
          ? correctif
          : undefined

      // ⛔ Le refus se dit AVANT le réseau, et avec des mots : le serveur, lui,
      //    ne rend qu’un `requete_refusee` sec. Un agent qui lit « exige un
      //    correctif » se corrige en un tour ; un agent qui lit « 400 » essaie
      //    autre chose au hasard.
      const refuse = refusDuMarquage({ statut, reponse, correctif: trace })
      if (refuse !== null) return echec(new Error(refuse))

      return rendre(() => client.marquer(id, { statut, reponse, correctif: trace }))
    },
  )
}
