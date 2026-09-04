/**
 * La barre de filtres — statut, type, zone, date.
 *
 * ⚠️ Un `<form method="get">` et rien d’autre : les filtres vivent dans l’URL,
 *    donc ils se recopient dans un message, se mettent en favori, et survivent à
 *    un rechargement. Une barre de filtres pilotée par un état de client perd
 *    les trois.
 *
 * ⛔ Ce n’est pas un tableau de bord. Il n’y a ni compteur, ni graphique, ni
 *    « retours cette semaine » : le lecteur vient chercher un retour précis
 *    (04-Architecture/DESIGN.md §2).
 */
import type { Filtres } from '../../domaine/backoffice/filtres'
import {
  LIBELLES_PERIODE,
  LIBELLES_STATUT,
  LIBELLES_TYPE,
  PERIODES,
  STATUTS,
  TYPES,
} from '../../domaine/backoffice/filtres'
import { Bouton } from '../bouton'
import { ChampSelect } from '../select'

const TOUS = ''

export function BarreFiltres({ filtres, zones }: { filtres: Filtres; zones: readonly string[] }) {
  return (
    <form
      method="get"
      action="/bo"
      className="flex flex-wrap items-end gap-3 rounded-[var(--radius-bo)] border border-bord bg-surface px-4 py-3"
    >
      <ChampSelect
        nom="statut"
        etiquette="Statut"
        valeur={filtres.statut ?? TOUS}
        options={[
          { valeur: TOUS, libelle: 'tous les statuts' },
          ...STATUTS.map((statut) => ({ valeur: statut, libelle: LIBELLES_STATUT[statut] })),
        ]}
      />

      <ChampSelect
        nom="type"
        etiquette="Type"
        valeur={filtres.type ?? TOUS}
        options={[
          { valeur: TOUS, libelle: 'tous les types' },
          ...TYPES.map((type) => ({ valeur: type, libelle: LIBELLES_TYPE[type] })),
        ]}
      />

      <ChampSelect
        nom="zone"
        etiquette="Zone"
        valeur={filtres.zone ?? TOUS}
        options={[
          { valeur: TOUS, libelle: 'toutes les zones' },
          ...zones.map((zone) => ({ valeur: zone, libelle: zone })),
        ]}
      />

      <ChampSelect
        nom="periode"
        etiquette="Date"
        valeur={filtres.periode}
        options={PERIODES.map((periode) => ({
          valeur: periode,
          libelle: LIBELLES_PERIODE[periode],
        }))}
      />

      <Bouton type="submit" ton="contour">
        Filtrer
      </Bouton>
    </form>
  )
}
