/**
 * L’écran « j’écoute » — le seul écran de Feedys qui n’a de modèle nulle part,
 * et donc le seul qu’on dessine vraiment (DESIGN.md §L’écran qui fait le
 * produit).
 *
 * Trois choses, dans l’ordre d’importance :
 *
 * 1. l’onde, qui réagit RÉELLEMENT à la voix ;
 * 2. le transcript, qui s’écrit en direct dessous — c’est la preuve que ça
 *    fonctionne, et ce qui permet de corriger sans réécouter ;
 * 3. la sortie, toujours visible : glisser pour annuler, ou relâcher.
 */
import { Onde } from './Onde'
import { SANS_ONDE, TEXTES } from './textes'
import type { PoigneeDictee } from './useDictee'

export interface ProprietesEcoute {
  readonly dictee: PoigneeDictee
}

/** ⚠️ Le compteur n’apparaît qu’après trente secondes. Il informe, il ne presse pas. */
const COMPTEUR_A_PARTIR_DE = 30

export function Ecoute({ dictee }: ProprietesEcoute) {
  const { ecoute, definitif, provisoire, duSon, secondes, sansOnde } = dictee
  if (ecoute === null) return null

  const transcript = `${definitif}${definitif !== '' && provisoire !== '' ? ' ' : ''}${provisoire}`

  return (
    <div class="ecoute">
      <Onde niveau={dictee.niveau} />

      {/*
        ⚠️ `aria-live="polite"` et non `assertive` : on annonce ce qui s’écrit,
           on ne coupe pas la parole de quelqu’un qui est en train de parler.
      */}
      <p class="ecoute__transcript" aria-live="polite">
        {transcript === '' ? <span class="ecoute__attente">{TEXTES.ecoute.attente}</span> : transcript}
      </p>

      {sansOnde !== null && (
        // ⚠️ Le seul cas où l’on dit quelque chose pendant l’écoute : l’onde ne
        //    viendra pas, et la personne doit savoir que la dictée CONTINUE
        //    quand même. ⛔ On ne s’excuse toujours pas — le champ texte est
        //    resté à un clic (ui/textes.ts §SANS_ONDE).
        <p class="ecoute__avis" role="status">
          {SANS_ONDE[sansOnde]}
        </p>
      )}

      <p class="ecoute__indices">
        {/* ⚠️ « Glisser pour annuler » n’apparaît qu’au PREMIER SON. Un texte
              affiché à vide est du bruit (DESIGN.md, exigence 4). */}
        <span class="ecoute__annuler">
          {duSon
            ? ecoute.origine === 'clavier'
              ? TEXTES.ecoute.annulerClavier
              : TEXTES.ecoute.annulerPointeur
            : ''}
        </span>
        <span class="ecoute__compteur">{secondes >= COMPTEUR_A_PARTIR_DE ? minutage(secondes) : ''}</span>
      </p>
    </div>
  )
}

function minutage(secondes: number): string {
  const minutes = Math.floor(secondes / 60)
  const reste = secondes % 60
  return `${minutes}:${String(reste).padStart(2, '0')}`
}
