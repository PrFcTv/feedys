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
import type { ContexteFiche, IndiceFiche } from '../../infra/base/depot-bo'

function Ligne({ libelle, valeur }: { libelle: string; valeur: string | null }) {
  if (valeur === null || valeur.trim() === '') return null

  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-[13px] text-encre-3">{libelle}</dt>
      <dd className="min-w-0 font-mono text-[13px] break-all text-encre-2">{valeur}</dd>
    </div>
  )
}

/** ⚠️ Le même arrondi que le widget : la seconde exacte ne dit rien de plus. */
function depuis(ecartMs: number | null): string {
  if (ecartMs === null) return ''

  const secondes = Math.round(ecartMs / 1000)
  if (secondes < 60) return `${secondes} s avant`

  const minutes = Math.round(secondes / 60)
  return minutes < 60 ? `${minutes} min avant` : `${Math.round(minutes / 60)} h avant`
}

/**
 * Ce que le navigateur a relevé avant l’ouverture (P-028, D-026).
 *
 * ⛔ SOUS LE CONTEXTE, ET JAMAIS PRÉSENTÉ COMME UNE CAUSE. Le titre dit
 *    « relevé », pas « à l’origine de ». Trois lignes techniques posées à côté
 *    d’un récit se lisent trop vite comme son explication : c’est au développeur
 *    de faire ce lien, et l’écart affiché est ce qui l’aide à le faire — 3 s
 *    avant, c’est presque sûrement lié ; 2 h avant, c’est du décor.
 *
 * ⚠️ LA RÉFÉRENCE EST LE CHAMP LE PLUS UTILE DE LA LIGNE, et c’est le plus
 *    léger. Elle emmène le développeur chez SON outil, où la pile est démappée,
 *    la version connue et le contexte serveur présent. ⛔ Feedys, lui, n’y va
 *    jamais — il compose un lien et s’arrête là (D-024).
 */
function BlocIndices({ indices }: { indices: readonly IndiceFiche[] }) {
  if (indices.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[13px] text-encre-3">
        Ce que le navigateur a relevé avant l’ouverture
      </h3>

      <ul className="flex flex-col gap-1.5">
        {indices.map((indice, rang) => (
          <li key={rang} className="font-mono text-[13px] break-all text-encre-2">
            {indice.genre === 'http'
              ? `${indice.statut ?? '?'} · ${indice.methode ? `${indice.methode} ` : ''}${indice.chemin ?? '?'}`
              : `${indice.nom ?? 'Exception'}${indice.trame ? ` · ${indice.trame}` : ''}`}

            {indice.ecartMs === null ? null : (
              <span className="ml-2 font-sans text-encre-3">{depuis(indice.ecartMs)}</span>
            )}

            {indice.reference === null ? null : (
              <span className="ml-2 font-sans">
                {indice.url === null ? (
                  // ⚠️ Pas d’outil déclaré sur le produit : la référence reste
                  //    lisible, elle n’est simplement pas cliquable — exactement
                  //    comme un SHA sans dépôt déclaré.
                  <span className="text-encre-3">{indice.reference}</span>
                ) : (
                  // ⚠️ `noreferrer` : l’outil de l’hôte n’a pas à savoir d’où
                  //    vient le clic.
                  <a
                    href={indice.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-encre-3 underline underline-offset-2 hover:text-encre"
                  >
                    {indice.reference}
                  </a>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function BlocContexte({
  contexte,
  indices,
  creeLe,
  capture,
}: {
  contexte: ContexteFiche | null
  indices: readonly IndiceFiche[]
  creeLe: Date
  capture: string | null
}) {
  if (contexte === null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-encre-3 italic">
          Le navigateur n’a rien pu joindre. La collecte est en échec-doux : elle n’empêche jamais
          un envoi.
        </p>
        {/* ⚠️ Rendu même sans contexte : les indices sont écrits dans une table
            à part, et rien n’oblige les deux à réussir ensemble. */}
        <BlocIndices indices={indices} />
      </div>
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

      <BlocIndices indices={indices} />

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
