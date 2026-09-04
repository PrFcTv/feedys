/**
 * `/bo` — la liste.
 *
 * ⛔ De la DENSITÉ, pas un tableau de bord : ni compteur, ni graphique, ni
 *    « retours cette semaine ». Un seul lecteur, deux visites par jour, qui vient
 *    chercher un retour précis (04-Architecture/DESIGN.md §2).
 *
 * ⚠️ Cette page ne fait que du routage et de la composition : elle lit les
 *    filtres, appelle le dépôt, rend (architecture.md §2).
 */
import Link from 'next/link'

import { lireFiltres, auMoinsUnFiltre } from '../../../domaine/backoffice/filtres'
import { exigerSession } from '../../../infra/backoffice/garde'
import { pool } from '../../../infra/base/connexion'
import { creerDepotBackOffice } from '../../../infra/base/depot-bo'
import { Bouton } from '../../../ui/bouton'
import { BarreFiltres } from '../../../ui/bo/barre-filtres'
import { LigneRetour } from '../../../ui/bo/ligne-retour'
import { Vide } from '../../../ui/vide'

import { seDeconnecter } from './actions'

export const dynamic = 'force-dynamic'

export default async function Liste({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await exigerSession()

  const filtres = lireFiltres(await searchParams)
  const depot = creerDepotBackOffice(pool())
  const maintenant = Date.now()

  const [retours, zones] = await Promise.all([
    depot.lister(filtres, maintenant),
    depot.zonesConnues(),
  ])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-titre text-xl text-encre">Les retours</h1>
          <p className="mt-0.5 text-[13px] text-encre-3">
            {retours.length === 0
              ? 'aucun retour'
              : `${retours.length} retour${retours.length > 1 ? 's' : ''}`}
          </p>
        </div>

        <form action={seDeconnecter}>
          <Bouton type="submit" ton="discret" taille="petit">
            Se déconnecter
          </Bouton>
        </form>
      </div>

      <BarreFiltres filtres={filtres} zones={zones} />

      {retours.length === 0 ? (
        auMoinsUnFiltre(filtres) ? (
          <Vide
            titre="Rien ne correspond à ces filtres"
            action={
              <Link href="/bo">
                <Bouton ton="contour">Voir tous les retours</Bouton>
              </Link>
            }
          >
            Les retours sont bien là — ce sont les filtres qui sont trop serrés. Élargissez la
            période, ou retirez le type.
          </Vide>
        ) : (
          <Vide titre="Aucun retour pour l’instant">
            Personne n’a encore ouvert la bulle. Posez la balise du widget sur un écran que les
            collaborateurs utilisent tous les jours, puis dictez-en un vous-même : c’est le
            meilleur moyen de vérifier que la chaîne complète fonctionne.
          </Vide>
        )
      ) : (
        <ul className="divide-y divide-bord overflow-hidden rounded-[var(--radius-bo)] border border-bord bg-surface">
          {retours.map((retour) => (
            <li key={retour.id}>
              <LigneRetour retour={retour} maintenant={maintenant} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
