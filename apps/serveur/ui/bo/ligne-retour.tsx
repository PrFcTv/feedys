/**
 * Une ligne de la liste.
 *
 * ⚠️ Densité : tout tient sur deux lignes, et la ligne entière est cliquable —
 *    le lecteur parcourt, il ne vise pas.
 *
 * ⚠️ Un retour SANS TITRE est un retour sans synthèse : la note a raté, ou
 *    l’entretien n’a rien produit. On le dit, plutôt que de laisser une ligne
 *    vide qu’on prendrait pour un défaut d’affichage.
 */
import Link from 'next/link'

import { age } from '../../domaine/backoffice/dates'
import type { LigneListe } from '../../infra/base/depot-bo'
import { Meta, PastilleConfiance, PastilleStatut, PastilleType } from '../pastille'

export function LigneRetour({
  retour,
  maintenant,
}: {
  retour: LigneListe
  maintenant: number
}) {
  return (
    <Link
      href={`/bo/r/${retour.id}`}
      className="flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-surface-2"
    >
      <div className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1 truncate font-medium text-encre">
          {retour.titre ?? <span className="text-encre-3 italic">sans note — synthèse absente</span>}
        </span>
        <Meta>{age(retour.creeLe, maintenant)}</Meta>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <PastilleType type={retour.type} />
        <PastilleStatut statut={retour.statut} />
        {retour.confiance === 'basse' ? <PastilleConfiance confiance="basse" /> : null}

        {retour.zone ? <Meta>{retour.zone}</Meta> : null}
        <Meta>·</Meta>
        <Meta>{retour.produitNom}</Meta>

        {retour.auteurNom ? (
          <>
            <Meta>·</Meta>
            <Meta>
              {retour.auteurNom}
              {/* ⚠️ L’identité non vérifiée se DIT. Le retour est accepté quand même
                  — on ne perd jamais une parole pour un problème de signature —
                  mais le lecteur doit savoir ce qu’il lit. */}
              {retour.identiteVerifiee ? '' : ' (identité non vérifiée)'}
            </Meta>
          </>
        ) : null}

        <Meta>·</Meta>
        <Meta>{retour.source === 'voix' ? 'dicté' : 'écrit'}</Meta>
      </div>
    </Link>
  )
}
