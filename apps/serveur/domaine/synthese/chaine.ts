/**
 * La chaîne d’une note : produire, écrire, notifier.
 *
 * ⛔ C’EST LE SEUL CHEMIN D’UNE NOTE. La fin d’entretien, le balayage, les
 *    reprises et le bouton « Refaire la note » l’empruntent tous. Il vit ici,
 *    et pas dans `infra/composition.ts`, pour une raison précise : les tests
 *    d’intégration des reprises doivent éprouver CE chemin-là, avec un modèle en
 *    bouchon — pas une recopie qui resterait verte le jour où celui-ci change
 *    (la faute que la relecture du lot 7 a trouvée deux fois).
 *
 * ⛔ Module pur (architecture.md §3).
 */
import type { PortsSynthese } from './produire'
import { etiquettesDe, produireSynthese } from './produire'
import type { IssueSynthese } from './reprise'

export interface PortsChaine {
  readonly synthese: PortsSynthese
  /** ⛔ N’interrompt jamais ce qui l’appelle : la note est déjà écrite. */
  notifier(retourId: string): Promise<void>
  readonly maximumRelances: number
}

/**
 * ⚠️ Elle REND son issue : le filet en a besoin pour décider s’il reprendra, et
 *    le bouton pour dire ce qui s’est passé. Avant P-030 elle rendait `void`, et
 *    un `modele_indisponible` n’existait qu’en console (BUGS_LOG 019).
 *
 * ⚠️ Une écriture qui échoue — la base, ou `syntheses_retour_uniq` qui refuse une
 *    seconde note — REMONTE : c’est l’appelant qui décide de l’avaler.
 */
export async function synthetiserEtNotifier(
  retourId: string,
  ports: PortsChaine,
): Promise<IssueSynthese> {
  const resultat = await produireSynthese(retourId, ports.synthese, ports.maximumRelances)

  if (!resultat.ok) {
    // ⚠️ `deja_faite` et `rien_a_synthetiser` sont des issues normales, pas des
    //    pannes : une double fin d’entretien est une course ordinaire.
    if (resultat.motif === 'modele_indisponible' || resultat.motif === 'retour_inconnu') {
      // ⚠️ L’identifiant, pas le corps : un cuid n’est pas de la parole.
      ports.synthese.signaler?.(
        `synthèse du retour ${retourId} — ${resultat.motif}, le filet la redemandera`,
        new Error(resultat.motif),
      )
    }
    return resultat.motif
  }

  await ports.synthese.depot.enregistrer(
    retourId,
    resultat.synthese,
    etiquettesDe(resultat.synthese.contenu),
  )

  // ⛔ APRÈS l’écriture, jamais avant : la notification est un confort, la note
  //    est déjà lisible au back-office et par MCP.
  await ports.notifier(retourId)
  return 'ecrite'
}
