/**
 * `/bo/r/:id` — la fiche.
 *
 * ⛔ L’ORDRE EST IMPOSÉ : **la synthèse, PUIS le fil de l’entretien, PUIS le
 *    contexte et la capture** (04-Architecture/DESIGN.md §La règle qui gouverne
 *    la fiche).
 *
 * ⛔ ET LE FIL BRUT N’EST JAMAIS REPLIÉ. Pas de « voir les détails ». La synthèse
 *    est une lecture ; le fil est la source.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { dateComplete } from '../../../../../domaine/backoffice/dates'
import { exigerSession } from '../../../../../infra/backoffice/garde'
import { pool } from '../../../../../infra/base/connexion'
import { creerDepotBackOffice } from '../../../../../infra/base/depot-bo'
import { Fil } from '../../../../../ui/bo/fil'
import { BlocContexte } from '../../../../../ui/bo/contexte'
import { FormulaireEtiquettes, FormulaireStatut } from '../../../../../ui/bo/corrections'
import { BlocSynthese, SansSynthese } from '../../../../../ui/bo/synthese'
import { Meta, PastilleStatut } from '../../../../../ui/pastille'

import { changerStatut, corrigerEtiquettes } from '../../actions'
import type { Issue } from '../../actions'

export const dynamic = 'force-dynamic'

function Section({
  titre,
  note,
  children,
}: {
  titre: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[var(--radius-bo)] border border-bord bg-surface p-5">
      <div className="mb-4 flex items-baseline gap-3 border-b border-bord pb-2.5">
        <h2 className="font-titre text-base text-encre">{titre}</h2>
        {note ? <Meta>{note}</Meta> : null}
      </div>
      {children}
    </section>
  )
}

export default async function FicheRetour({ params }: { params: Promise<{ id: string }> }) {
  await exigerSession()

  const { id } = await params
  const fiche = await creerDepotBackOffice(pool()).fiche(id)
  if (fiche === null) notFound()

  // ⚠️ Les actions sont liées à l’id ICI, côté serveur. L’identifiant du retour
  //    ne transite donc pas par un champ de formulaire, où il serait modifiable.
  async function poserStatut(_etat: Issue | null, donnees: FormData): Promise<Issue> {
    'use server'
    return changerStatut(id, donnees)
  }

  async function poserEtiquettes(_etat: Issue | null, donnees: FormData): Promise<Issue> {
    'use server'
    return corrigerEtiquettes(id, donnees)
  }

  const auteur = fiche.auteurNom
    ? `${fiche.auteurNom}${fiche.auteurRole ? ` (${fiche.auteurRole})` : ''}`
    : 'auteur inconnu'

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/bo" className="text-[13px] text-encre-3 hover:text-encre">
          ← tous les retours
        </Link>

        <h1 className="mt-2 font-titre text-xl leading-snug text-encre">
          {fiche.titre ?? 'Retour sans note'}
        </h1>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <PastilleStatut statut={fiche.statut} />
          <Meta>{fiche.produitNom}</Meta>
          <Meta>·</Meta>
          <Meta>{auteur}</Meta>
          {fiche.identiteVerifiee ? null : <Meta>· identité non vérifiée</Meta>}
          <Meta>·</Meta>
          <Meta>{dateComplete(fiche.creeLe, fiche.contexte?.fuseau)}</Meta>
          <Meta>·</Meta>
          <Meta>{fiche.source === 'voix' ? 'dicté' : 'écrit'}</Meta>
        </div>
      </div>

      {/* ── 1. LA SYNTHÈSE ─────────────────────────────────────────────────── */}
      <Section titre="La note" note={fiche.modele ? `modèle ${fiche.modele}` : undefined}>
        {fiche.synthese === null ? (
          <SansSynthese type={fiche.type} />
        ) : (
          <BlocSynthese synthese={fiche.synthese} />
        )}
      </Section>

      {/* ── Les seules corrections possibles ───────────────────────────────── */}
      <Section
        titre="Corriger"
        note="⛔ des étiquettes, pas de la parole — ni le résumé, ni les citations, ni le fil"
      >
        <div className="flex flex-col gap-4">
          <FormulaireStatut action={poserStatut} statut={fiche.statut} />
          <FormulaireEtiquettes action={poserEtiquettes} type={fiche.type} zone={fiche.zone} />
        </div>
      </Section>

      {/* ── 2. LE FIL — ⛔ jamais replié ────────────────────────────────────── */}
      <Section titre="Le fil de l’entretien" note="la source — la note n’en est qu’une lecture">
        <Fil fil={fiche.fil} />
      </Section>

      {/* ── 3. LE CONTEXTE ET LA CAPTURE, en dernier ───────────────────────── */}
      <Section titre="Le contexte technique">
        <BlocContexte
          contexte={fiche.contexte}
          creeLe={fiche.creeLe}
          capture={fiche.contexte?.captureChemin ? `/bo/r/${fiche.id}/capture` : null}
        />
      </Section>

      {fiche.notification === null ? null : (
        <p className="text-[13px] text-encre-3">
          Notification par email : <span className="font-mono">{fiche.notification.statut}</span>
          {fiche.notification.erreur ? ` — ${fiche.notification.erreur}` : ''}
        </p>
      )}
    </div>
  )
}
