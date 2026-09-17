/**
 * `/bo/installation` — l’état de CETTE installation.
 *
 * ⚠️ POURQUOI UNE PAGE. La liste d’installation demande un message d’essai
 *    reçu sur un téléphone, et une installation par client n’a pas de dépôt,
 *    pas de `pnpm`, pas de `curl` qu’on tape sur le VPS (P-030). Le bouton est
 *    ici, avec ce qu’il faut pour comprendre pourquoi il ne marcherait pas.
 *
 * ⛔ CE N’EST PAS UN TABLEAU DE BORD. Ni compteur, ni graphique, ni « retours
 *    cette semaine » (01-Specs/back-office.md). Les canaux configurés, et les
 *    incidents ouverts — des faits d’exploitation, pas des statistiques.
 *
 * ⛔ AUCUNE VALEUR DE VARIABLE N’EST AFFICHÉE. Des noms, et un état.
 */
import Link from 'next/link'

import { dateComplete } from '../../../../domaine/backoffice/dates'
import type { EtatCanal } from '../../../../domaine/demarrage/controles'
import { VARIABLES_EMAIL, VARIABLES_TELEGRAM, verdictCanaux } from '../../../../domaine/demarrage/controles'
import { LIBELLES_ALERTE } from '../../../../domaine/veille/alertes'
import { exigerSession } from '../../../../infra/backoffice/garde'
import { pool } from '../../../../infra/base/connexion'
import { creerDepotVeille } from '../../../../infra/base/depot-veille'
import { EssaiTelegram } from '../../../../ui/bo/essai-telegram'
import { Meta } from '../../../../ui/pastille'

import { envoyerEssai } from '../actions'

export const dynamic = 'force-dynamic'

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-bo)] border border-bord bg-surface p-5">
      <h2 className="mb-4 border-b border-bord pb-2.5 font-titre text-base text-encre">{titre}</h2>
      {children}
    </section>
  )
}

function Etat({ etat, variables }: { etat: EtatCanal; variables: readonly string[] }) {
  switch (etat.etat) {
    case 'configure':
      return <span className="text-encre">configuré</span>
    case 'absent':
      return (
        <span className="text-encre-3">
          non configuré — <span className="font-mono text-[13px]">{variables.join(', ')}</span>
        </span>
      )
    case 'incomplet':
      return (
        <span className="text-signal">
          incomplet — il manque <span className="font-mono text-[13px]">{etat.manquantes.join(', ')}</span>
        </span>
      )
    case 'mal_forme':
      return (
        <span className="text-signal">
          mal formé — <span className="font-mono text-[13px]">{etat.variables.join(', ')}</span>
        </span>
      )
  }
}

export default async function Installation() {
  await exigerSession()

  const canaux = verdictCanaux(process.env)
  const incidents = [...(await creerDepotVeille(pool()).ouvertes())]
  const telegramPart = canaux.telegram.etat === 'configure' || canaux.telegram.etat === 'mal_forme'

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/bo" className="text-[13px] text-encre-3 hover:text-encre">
          ← tous les retours
        </Link>
        <h1 className="mt-2 font-titre text-xl text-encre">L’installation</h1>
      </div>

      <Section titre="Les canaux">
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex gap-3">
            <dt className="w-28 shrink-0 text-encre-3">Telegram</dt>
            <dd>
              <Etat etat={canaux.telegram} variables={VARIABLES_TELEGRAM} />
              <Meta> · recommandé — l’avis de chaque retour, et les alertes</Meta>
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-28 shrink-0 text-encre-3">Email</dt>
            <dd>
              <Etat etat={canaux.email} variables={VARIABLES_EMAIL} />
              <Meta> · la note entière</Meta>
            </dd>
          </div>
        </dl>

        {telegramPart ? (
          <div className="mt-5">
            <EssaiTelegram action={envoyerEssai} />
          </div>
        ) : (
          <p className="mt-5 max-w-prose text-[13px] text-encre-3">
            Sans Telegram, les alertes restent dans les journaux du conteneur.
          </p>
        )}
      </Section>

      <Section titre="Les incidents ouverts">
        {incidents.length === 0 ? (
          <p className="text-sm text-encre-2">Aucun incident ouvert.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {incidents.map(([genre, incident]) => (
              <li key={incident.id}>
                <span className="text-encre">{LIBELLES_ALERTE[genre]}</span>
                <Meta> · depuis le {dateComplete(incident.ouverteLe)} (UTC)</Meta>
                <Meta>
                  {' · '}
                  {incident.envoyeeLe
                    ? 'annoncé par Telegram'
                    : `pas annoncé — ${incident.erreur ?? 'raison inconnue'}`}
                </Meta>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
