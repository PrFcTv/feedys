/**
 * ⚠️ Le guet est pur : il reçoit un niveau et un horodatage, il rend un verdict.
 *    C’est ce qui permet de vérifier « cinq secondes de silence » sans attendre
 *    cinq secondes, et de rejouer un open space bruyant à volonté.
 */
import { describe, expect, it } from 'vitest'

import { guetterSilence } from './silence'

/** Joue une suite de niveaux à 60 images par seconde. Rend l’instant de l’arrêt. */
function jouer(niveaux: readonly number[], depart = 0): number | undefined {
  const guet = guetterSilence()

  for (let image = 0; image < niveaux.length; image += 1) {
    const horodatage = depart + image * 16
    if (guet.observer(niveaux[image] ?? 0, horodatage)) return horodatage
  }

  return undefined
}

/** `secondes` d’un niveau constant, à 60 images par seconde. */
function tenir(niveau: number, secondes: number): number[] {
  return Array.from({ length: Math.round((secondes * 1000) / 16) }, () => niveau)
}

describe('guetterSilence', () => {
  it('s’arrête cinq secondes après la fin de la parole', () => {
    const arret = jouer([...tenir(0.001, 0.5), ...tenir(0.2, 1), ...tenir(0.001, 6)])

    expect(arret).toBeDefined()
    // Parole finie à 1,5 s ; l’arrêt tombe à 6,5 s, à une image près.
    expect(arret).toBeGreaterThanOrEqual(6_450)
    expect(arret).toBeLessThanOrEqual(6_600)
  })

  it('⛔ ne s’arrête pas avant que quelqu’un ait parlé — on cherche ses mots', () => {
    // Dix secondes de silence complet, sans un mot. Personne n’est coupé.
    expect(jouer(tenir(0.001, 10))).toBeUndefined()
  })

  it('⛔ ne coupe pas quelqu’un qui parle encore, même longtemps', () => {
    expect(jouer([...tenir(0.001, 0.5), ...tenir(0.18, 12)])).toBeUndefined()
  })

  it('⛔ tient dans un open space : le bruit de fond n’est pas de la parole', () => {
    // Un fond à 0,04 — bruyant — puis de la parole à 0,25, puis le fond seul.
    // ⚠️ Un seuil FIXE échouerait ici : soit il ne s’arrêterait jamais, soit il
    //    prendrait le fond pour de la parole.
    const arret = jouer([...tenir(0.04, 0.6), ...tenir(0.25, 1), ...tenir(0.04, 6)])

    expect(arret).toBeDefined()
    expect(arret).toBeGreaterThanOrEqual(6_500)
  })

  it('⛔ ne prend pas le silence d’un bureau calme pour de la parole', () => {
    // Fond très bas, parole nette : l’arrêt doit venir, et pas plus tard.
    const arret = jouer([...tenir(0.0005, 0.5), ...tenir(0.15, 0.8), ...tenir(0.0005, 6)])

    expect(arret).toBeDefined()
  })

  it('⚠️ une pause de réflexion entre deux phrases ne coupe pas', () => {
    // ⚠️ Quatre secondes : « alors… le bouton… euh… ». C’est ce silence-là qui
    //    coupait la parole à deux secondes (03-Bugs/BUGS_LOG.md 008).
    const arret = jouer([
      ...tenir(0.002, 0.5),
      ...tenir(0.2, 1),
      ...tenir(0.002, 4), // on cherche ses mots
      ...tenir(0.2, 1),
      ...tenir(0.002, 4), // on les cherche encore
      ...tenir(0.2, 1),
    ])

    expect(arret).toBeUndefined()
  })

  it('ne parle qu’une fois — une boucle de rendu ne déclenche pas dix arrêts', () => {
    const guet = guetterSilence()
    const niveaux = [...tenir(0.001, 0.5), ...tenir(0.2, 1), ...tenir(0.001, 6)]

    let arrets = 0
    for (let image = 0; image < niveaux.length; image += 1) {
      if (guet.observer(niveaux[image] ?? 0, image * 16)) arrets += 1
    }

    expect(arrets).toBe(1)
  })

  it('dit si du son a été entendu — c’est ce qui fait apparaître « glisser pour annuler »', () => {
    const guet = guetterSilence()

    for (let image = 0; image < 40; image += 1) guet.observer(0.001, image * 16)
    expect(guet.aEntenduDuSon()).toBe(false)

    for (let image = 40; image < 80; image += 1) guet.observer(0.3, image * 16)
    expect(guet.aEntenduDuSon()).toBe(true)
  })

  it('respecte un délai réglé', () => {
    const guet = guetterSilence({ apresMs: 500, calibrageMs: 100 })
    const niveaux = [...tenir(0.001, 0.2), ...tenir(0.2, 0.3), ...tenir(0.001, 1)]

    let arret: number | undefined
    for (let image = 0; image < niveaux.length; image += 1) {
      if (guet.observer(niveaux[image] ?? 0, image * 16)) {
        arret = image * 16
        break
      }
    }

    expect(arret).toBeDefined()
    expect(arret).toBeLessThan(1_200)
  })
})

/**
 * ⚠️ Le délai par défaut est un ARBITRAGE, pas un réglage esthétique. Il a été
 *    porté de deux à cinq secondes après la première dictée réelle
 *    ([D-017](../../../../00-Projet/DECISIONS_LOG.md)) : deux secondes coupaient
 *    quelqu’un qui cherchait ses mots, ce qui est le mode de défaillance que ce
 *    module dit lui-même vouloir éviter.
 */
describe('le délai par défaut', () => {
  const AVANT_CINQ_SECONDES = 4_500
  const APRES_CINQ_SECONDES = 5_100

  function parlerPuisSeTaire(jusqua: number): boolean {
    const guet = guetterSilence()
    // Calibrage dans le silence, puis un mot, puis plus rien.
    for (let t = 0; t <= 400; t += 50) guet.observer(0, t)
    guet.observer(0.4, 500)

    let arret = false
    for (let t = 550; t <= 500 + jusqua; t += 50) {
      if (guet.observer(0, t)) arret = true
    }
    return arret
  }

  it('⛔ ne coupe pas quelqu’un qui réfléchit quatre secondes', () => {
    expect(parlerPuisSeTaire(AVANT_CINQ_SECONDES)).toBe(false)
  })

  it('finit par s’arrêter — passé cinq secondes', () => {
    expect(parlerPuisSeTaire(APRES_CINQ_SECONDES)).toBe(true)
  })
})
