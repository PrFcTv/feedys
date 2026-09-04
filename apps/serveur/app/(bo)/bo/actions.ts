'use server'

/**
 * Les deux seules écritures du back-office, plus la déconnexion.
 *
 * ⛔ TROIS CHAMPS, ET PAS UN DE PLUS : `statut`, `type`, `zone`. Le refus est
 *    porté par `domaine/backoffice/correction.ts`, dont les schémas sont
 *    `.strict()` — un formulaire forgé qui poste `texte`, `resume` ou
 *    `citations` est REFUSÉ, pas ignoré. C’est le point d’acceptation de P-010,
 *    et c’est pourquoi le `FormData` est passé ENTIER au schéma : un champ hors
 *    liste doit se heurter à un « non », pas à un haussement d’épaules.
 *
 * ⛔ Chaque changement écrit sa ligne d’audit DANS LA MÊME TRANSACTION
 *    (`infra/base/depot-bo.ts`). Un changement sans trace, c’est une histoire du
 *    retour qui ment.
 *
 * ⚠️ La garde est répétée ici : une garde posée seulement sur l’affichage
 *    protège l’écran, pas l’écriture.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  lireChangementEtiquettes,
  lireChangementStatut,
} from '../../../domaine/backoffice/correction'
import { exigerSession, fermerSession } from '../../../infra/backoffice/garde'
import { pool } from '../../../infra/base/connexion'
import { creerDepotBackOffice } from '../../../infra/base/depot-bo'

export type Issue = { readonly ok: true } | { readonly ok: false; readonly message: string }

const REFUS: Record<string, string> = {
  champ_inconnu:
    'Refusé : seuls le statut, le type et la zone se corrigent. Ni le résumé, ni les citations, ni le fil.',
  valeur_refusee: 'Refusé : cette valeur n’est pas dans la liste.',
  retour_inconnu: 'Ce retour n’existe pas.',
}

function refus(motif: string): Issue {
  return { ok: false, message: REFUS[motif] ?? 'Refusé.' }
}

/**
 * ⚠️ Le `FormData` est rendu ENTIER, champs inconnus compris. C’est le schéma
 *    strict qui dit non — et il ne peut le dire que s’il les voit.
 *
 * ⚠️ Les entrées `$…` sont posées par React pour ses propres besoins (identité
 *    de l’action, jeton) : elles ne viennent pas du formulaire.
 */
function objetDe(donnees: FormData): Record<string, unknown> {
  const brut: Record<string, unknown> = {}

  for (const [nom, valeur] of donnees.entries()) {
    if (nom.startsWith('$')) continue
    brut[nom] = typeof valeur === 'string' ? valeur : '(fichier)'
  }

  return brut
}

export async function changerStatut(retourId: string, donnees: FormData): Promise<Issue> {
  await exigerSession()

  const lu = lireChangementStatut(objetDe(donnees))
  if (!lu.ok) return refus(lu.motif)

  if (!(await creerDepotBackOffice(pool()).changerStatut(retourId, lu.valeur))) {
    return refus('retour_inconnu')
  }

  revalidatePath(`/bo/r/${retourId}`)
  revalidatePath('/bo')
  return { ok: true }
}

export async function corrigerEtiquettes(retourId: string, donnees: FormData): Promise<Issue> {
  await exigerSession()

  const lu = lireChangementEtiquettes(objetDe(donnees))
  if (!lu.ok) return refus(lu.motif)

  if (!(await creerDepotBackOffice(pool()).corrigerEtiquettes(retourId, lu.valeur))) {
    return refus('retour_inconnu')
  }

  revalidatePath(`/bo/r/${retourId}`)
  revalidatePath('/bo')
  return { ok: true }
}

export async function seDeconnecter(): Promise<void> {
  await fermerSession()
  redirect('/connexion')
}
