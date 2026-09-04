/**
 * Le contexte technique et la capture — en DERNIER sur la fiche.
 *
 * ⚠️ En dernier parce qu’on ne le lit qu’en cas de besoin. Le mettre en tête
 *    ferait relire six lignes de `user-agent` avant d’arriver à ce que quelqu’un
 *    a voulu dire (04-Architecture/DESIGN.md §La règle qui gouverne la fiche).
 *
 * ⚠️ Mono : c’est de la donnée machine, et ça doit se lire comme telle.
 */
import { dateComplete } from '../../domaine/backoffice/dates'
import type { ContexteFiche } from '../../infra/base/depot-bo'

function Ligne({ libelle, valeur }: { libelle: string; valeur: string | null }) {
  if (valeur === null || valeur.trim() === '') return null

  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-[13px] text-encre-3">{libelle}</dt>
      <dd className="min-w-0 font-mono text-[13px] break-all text-encre-2">{valeur}</dd>
    </div>
  )
}

export function BlocContexte({
  contexte,
  creeLe,
  capture,
}: {
  contexte: ContexteFiche | null
  creeLe: Date
  capture: string | null
}) {
  if (contexte === null) {
    return (
      <p className="text-sm text-encre-3 italic">
        Le navigateur n’a rien pu joindre. La collecte est en échec-doux : elle n’empêche jamais un
        envoi.
      </p>
    )
  }

  const fenetre =
    contexte.viewportL && contexte.viewportH
      ? `${contexte.viewportL} × ${contexte.viewportH}`
      : null

  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col gap-1.5">
        <Ligne libelle="Page" valeur={contexte.url} />
        <Ligne libelle="Titre de la page" valeur={contexte.titrePage} />
        <Ligne libelle="Écran" valeur={contexte.ecran} />
        <Ligne libelle="Composant visé" valeur={contexte.selecteurDom} />
        <Ligne libelle="Navigateur" valeur={contexte.navigateur} />
        <Ligne libelle="Système" valeur={contexte.systeme} />
        <Ligne libelle="Fenêtre" valeur={fenetre} />
        <Ligne libelle="Fuseau" valeur={contexte.fuseau} />
        <Ligne libelle="Reçu le" valeur={dateComplete(creeLe, contexte.fuseau)} />
      </dl>

      {capture === null ? null : (
        <figure className="max-w-3xl">
          {/* ⚠️ `<img>` et non `next/image` : la capture est servie par une route
              d’actifs du serveur, sa taille n’est pas connue à l’avance, et
              l’optimiseur n’a rien à y gagner sur une image vue deux fois. */}
          <img
            src={capture}
            alt="La capture de l’écran au moment du retour"
            className="w-full rounded-[var(--radius-bo)] border border-bord"
          />
          <figcaption className="mt-1.5 text-[13px] text-encre-3">
            L’écran au moment où la personne a ouvert la bulle.
          </figcaption>
        </figure>
      )}
    </div>
  )
}
