// @vitest-environment happy-dom
/**
 * La recette automatisable de la coquille.
 *
 * ⚠️ Elle ne remplace PAS `pnpm widget:demo` : ce qui se casse chez un hôte —
 *    les styles qui fuient, le z-index, une modale par-dessus — ne se voit que
 *    dans un vrai navigateur, dans une vraie page hostile. Ce fichier tient les
 *    invariants qu’une page ne montre pas : le shadow DOM fermé, l’absence
 *    d’appel réseau avant le clic, le piège à focus, le brouillon conservé.
 *
 * ⚠️ `attachShadow` est instrumenté — c’est la seule façon d’entrer dans une
 *    racine FERMÉE, et ça vérifie du même coup qu’elle l’est bien.
 */
import { act } from 'preact/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Configuration } from './configuration'
import type { Comprehension, Contexte, CorpsFin, CorpsRetour, CorpsTour } from './contrat'
import type { ResultatTour } from './entretien'
import type { Resultat } from './envoi'
import { monter } from './montage'
import type { Ports } from './ui/Widget'

const CONFIGURATION: Configuration = {
  cle: 'fdy_pub_a1b2c3',
  origine: 'https://feedys.exemple.fr',
  position: 'bas-droite',
}

const CONTEXTE: Contexte = { url: 'https://victoria.exemple.fr/dossiers' }

/** ⚠️ Écrite à la main. ⛔ Jamais un vrai retour copié d’une base (CLAUDE.md §Secrets). */
const CARTE: Comprehension = {
  type: 'bug',
  titre: 'Le tri par date se réinitialise au retour sur la page',
  resume: 'La personne repose le tri à chaque navigation.',
  ecran: 'Liste des dossiers',
}

const vraiAttachShadow = Element.prototype.attachShadow
let racines: ShadowRoot[] = []
let modes: string[] = []

beforeEach(() => {
  racines = []
  modes = []
  Element.prototype.attachShadow = function (init: ShadowRootInit): ShadowRoot {
    modes.push(init.mode)
    const racine = vraiAttachShadow.call(this, init)
    racines.push(racine)
    return racine
  }
})

afterEach(() => {
  Element.prototype.attachShadow = vraiAttachShadow
  document.body.innerHTML = ''
  vi.useRealTimers()
})

function installer(remplacements: Partial<Ports> = {}) {
  const collecter = vi.fn(async () => CONTEXTE)
  const envois: CorpsRetour[] = []
  const envoyer = vi.fn(async (corps: CorpsRetour): Promise<Resultat> => {
    envois.push(corps)
    return { ok: true, retour: 'ret_1' }
  })

  // ⚠️ Le cas ordinaire : le bot comprend et pose UNE question. Les cas
  //    particuliers — modèle muet, plus de question — sont surchargés au test.
  const tours: CorpsTour[] = []
  const demanderTour = vi.fn(async (_retour: string, corps: CorpsTour): Promise<ResultatTour> => {
    tours.push(corps)
    return {
      ok: true,
      tour: { comprehension: CARTE, question: 'C’est nouveau ?', motif: 'la récurrence' },
    }
  })

  const fins: CorpsFin[] = []
  const terminer = vi.fn(async (_retour: string, corps: CorpsFin): Promise<boolean> => {
    fins.push(corps)
    return true
  })

  // ⚠️ Le montage passe par `act` : sans lui, les effets de Preact sont
  //    programmés par `requestAnimationFrame`, que `act` n’intercepte que
  //    pendant son propre appel. `brancher` ne serait alors jamais branché.
  let montage!: ReturnType<typeof monter>
  void act(() => {
    montage = monter(CONFIGURATION, {
      ports: { collecter, envoyer, demanderTour, terminer, ...remplacements },
    })
  })

  const racine = racines[0]
  if (!racine) throw new Error('aucune racine fantôme')

  return {
    montage,
    racine,
    collecter,
    envoyer,
    envois,
    demanderTour,
    tours,
    terminer,
    fins,
    hote: document.querySelector('feedys-widget') as HTMLElement,
    trouver: <T extends Element>(selecteur: string) => racine.querySelector<T>(selecteur),
  }
}

const lanceurDe = (racine: ShadowRoot) => racine.querySelector<HTMLButtonElement>('.lanceur')!
const champDe = (racine: ShadowRoot) => racine.querySelector<HTMLTextAreaElement>('.champ')!

/**
 * ⚠️ Un tour de manège pour laisser les promesses aboutir : `act` vide la file
 *    de rendu, mais l’envoi enchaîne deux `await` avant de poser son état.
 */
async function calmer(): Promise<void> {
  await act(async () => {
    for (let tour = 0; tour < 6; tour += 1) await Promise.resolve()
  })
}

async function ouvrir(racine: ShadowRoot): Promise<void> {
  await act(async () => {
    lanceurDe(racine).click()
  })
  await calmer()
}

async function cliquerEnvoyer(racine: ShadowRoot): Promise<void> {
  await act(async () => {
    racine.querySelector<HTMLButtonElement>('.envoyer')!.click()
  })
  await calmer()
}

async function cliquerRepondre(racine: ShadowRoot): Promise<void> {
  await act(async () => {
    racine.querySelector<HTMLButtonElement>('.repondre')!.click()
  })
  await calmer()
}

/** Écrire puis envoyer : la parole est en base, l’entretien commence. */
async function entrerEnEntretien(racine: ShadowRoot, texte = 'le tri par date se remet à zéro'): Promise<void> {
  await ouvrir(racine)
  await ecrire(racine, texte)
  await cliquerEnvoyer(racine)
}

async function ecrire(racine: ShadowRoot, texte: string): Promise<void> {
  const champ = champDe(racine)
  await act(async () => {
    champ.value = texte
    champ.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function touche(cible: Element, key: string, shiftKey = false): void {
  cible.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }))
}

describe('monter — l’isolation', () => {
  it('pose un <feedys-widget> et un shadow DOM FERMÉ', () => {
    const { hote } = installer()

    expect(hote).not.toBeNull()
    expect(modes).toEqual(['closed'])
    // ⛔ Fermé : aucun script de l’hôte ne lit, ne style ni ne déplace nos nœuds.
    expect(hote.shadowRoot).toBeNull()
  })

  it('verrouille l’élément hôte en ligne et en !important', () => {
    const { hote } = installer()

    // ⚠️ Une feuille d’auteur `* { position: static !important }` — il en existe —
    //    décrocherait le widget de son ancrage sans cette précaution.
    expect(hote.style.getPropertyValue('position')).toBe('fixed')
    expect(hote.style.getPropertyPriority('position')).toBe('important')
    expect(hote.style.getPropertyPriority('transform')).toBe('important')
    expect(hote.style.getPropertyValue('transform')).toBe('none')
    expect(Number(hote.style.getPropertyValue('z-index'))).toBeGreaterThan(9999)
    // L’élément lui-même n’intercepte rien : il n’a pas de surface.
    expect(hote.style.getPropertyValue('pointer-events')).toBe('none')
  })

  it('emporte tout avec lui quand on le démonte', () => {
    const { montage } = installer()

    montage.demonter()

    expect(document.querySelector('feedys-widget')).toBeNull()
  })
})

describe('FERMÉ — le lanceur', () => {
  it('ne montre que le lanceur, avec son libellé', () => {
    const { racine, trouver } = installer()

    expect(trouver('.panneau')).toBeNull()
    expect(lanceurDe(racine).textContent).toContain('Un retour')
    expect(lanceurDe(racine).getAttribute('aria-expanded')).toBe('false')
  })

  // ⛔ « Le premier appel réseau a lieu quand on CLIQUE, pas au chargement »
  //    (01-Specs/widget.md §1). La capture, donc snapdom, est dans `collecter`.
  it('ne demande rien à personne avant le premier clic', () => {
    const { collecter, envoyer } = installer()

    expect(collecter).not.toHaveBeenCalled()
    expect(envoyer).not.toHaveBeenCalled()
  })

  it('ne s’ouvre pas tout seul', async () => {
    const { trouver } = installer()

    await act(async () => {})

    expect(trouver('.panneau')).toBeNull()
  })
})

describe('OUVERT — l’accueil', () => {
  it('ouvre au clic, collecte le contexte à cet instant, et pose le focus dans le champ', async () => {
    const { racine, collecter } = installer()

    await ouvrir(racine)

    expect(racine.querySelector('.panneau')).not.toBeNull()
    expect(collecter).toHaveBeenCalledTimes(1)
    expect(racine.activeElement).toBe(champDe(racine))
    expect(lanceurDe(racine).getAttribute('aria-expanded')).toBe('true')
  })

  it('est une boîte de dialogue modale correctement annoncée', async () => {
    const { racine, trouver } = installer()

    await ouvrir(racine)

    const panneau = trouver('.panneau')!
    expect(panneau.getAttribute('role')).toBe('dialog')
    expect(panneau.getAttribute('aria-modal')).toBe('true')
    expect(racine.querySelector(`#${panneau.getAttribute('aria-labelledby')}`)?.textContent).toContain(
      'Qu’est-ce qui se passe ?',
    )
  })

  it('Échap ferme et rend le focus au lanceur', async () => {
    const { racine } = installer()

    await ouvrir(racine)
    await act(async () => {
      touche(champDe(racine), 'Escape')
    })

    expect(racine.querySelector('.panneau')).toBeNull()
    expect(racine.activeElement).toBe(lanceurDe(racine))
  })

  it('piège le focus : Tab depuis le dernier revient au premier, et l’inverse', async () => {
    const { racine, trouver } = installer()

    await ouvrir(racine)
    await ecrire(racine, 'le tri par date se remet à zéro')

    const fermer = trouver<HTMLButtonElement>('.fermer')!
    const envoyer = trouver<HTMLButtonElement>('.envoyer')!

    envoyer.focus()
    await act(async () => {
      touche(envoyer, 'Tab')
    })
    expect(racine.activeElement).toBe(fermer)

    await act(async () => {
      touche(fermer, 'Tab', true)
    })
    expect(racine.activeElement).toBe(envoyer)
  })

  it('n’envoie rien tant que le champ est vide', async () => {
    const { racine, trouver } = installer()

    await ouvrir(racine)

    expect(trouver<HTMLButtonElement>('.envoyer')!.disabled).toBe(true)
  })
})

describe('EN ENTRETIEN — la carte de compréhension', () => {
  it('envoie le texte avec son contexte, déclare source « texte », puis demande un tour', async () => {
    const { racine, envois, tours, trouver } = installer()

    await entrerEnEntretien(racine, '  le tri par date se remet à zéro  ')

    expect(envois).toEqual([
      {
        texte: 'le tri par date se remet à zéro',
        // ⚠️ Pas décoratif : c’est la mesure du pari du produit.
        source: 'texte',
        contexte: CONTEXTE,
      },
    ])
    // ⚠️ Le premier tour n’apporte rien : la parole est déjà en base.
    expect(tours).toEqual([{}])
    expect(trouver('.carte')).not.toBeNull()
  })

  it('⛔ pose la question SOUS la carte, jamais dedans', async () => {
    const { racine, trouver } = installer()

    await entrerEnEntretien(racine)

    const carte = trouver('.carte')!
    const question = trouver('.question')!
    expect(question.textContent).toBe('C’est nouveau ?')
    expect(carte.contains(question)).toBe(false)
    // ⚠️ La question est annoncée, pas seulement affichée.
    expect(question.getAttribute('role')).toBe('status')
    // ⛔ La carte vient avant la question dans l’ordre du document.
    expect(carte.compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('⛔ n’a AUCUN bouton de validation — on corrige, ça part avec le tour suivant', async () => {
    const { racine, trouver } = installer()

    await entrerEnEntretien(racine)

    const boutons = [...trouver('.carte')!.querySelectorAll('button')]
    expect(boutons).toHaveLength(0)
    expect(trouver('.carte')!.textContent).not.toMatch(/valider|enregistrer|confirmer/i)
  })

  it('⛔ « Envoyer maintenant » est visible ET actif à chaque tour, champ vide compris', async () => {
    const { racine, trouver } = installer()

    await entrerEnEntretien(racine)

    const envoyer = trouver<HTMLButtonElement>('.envoyer')!
    expect(envoyer.textContent).toContain('Envoyer maintenant')
    expect(envoyer.disabled).toBe(false)
  })

  it('garde micro et champ texte disponibles pour répondre', async () => {
    const { racine, trouver } = installer({ dicteeDisponible: () => true })

    await entrerEnEntretien(racine)

    expect(trouver('.micro')).not.toBeNull()
    expect(trouver('.champ')).not.toBeNull()
  })

  it('emporte la réponse au tour suivant, et vide le champ', async () => {
    const { racine, tours } = installer()

    await entrerEnEntretien(racine)
    await ecrire(racine, 'non ça a toujours fait ça')
    await cliquerRepondre(racine)

    expect(tours[1]).toEqual({ texte: 'non ça a toujours fait ça' })
    expect(champDe(racine).value).toBe('')
  })

  it('emporte la CORRECTION d’un champ, en clair, avec le tour suivant', async () => {
    const { racine, tours, trouver } = installer()

    await entrerEnEntretien(racine)

    const ecran = trouver<HTMLInputElement>('.carte input.carte__valeur')!
    await act(async () => {
      ecran.value = 'Liste des mandats'
      ecran.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await cliquerRepondre(racine)

    expect(tours[1]).toEqual({ corrections: 'Écran — Liste des mandats' })
  })

  it('⛔ n’envoie aucune correction quand rien n’a été corrigé', async () => {
    const { racine, tours } = installer()

    await entrerEnEntretien(racine)
    await ecrire(racine, 'oui')
    await cliquerRepondre(racine)

    expect(tours[1]).not.toHaveProperty('corrections')
  })

  it('⛔ modèle muet : pas de carte, le champ reste, « Envoyer » fonctionne', async () => {
    const { racine, trouver, fins } = installer({
      demanderTour: async (): Promise<ResultatTour> => ({ ok: false }),
    })

    await entrerEnEntretien(racine)

    expect(trouver('.carte')).toBeNull()
    expect(trouver('.question')).toBeNull()
    expect(trouver('.champ')).not.toBeNull()

    await cliquerEnvoyer(racine)
    expect(fins).toEqual([{ raison: 'envoi' }])
  })

  it('⛔ ce que la personne venait d’écrire part AVEC « Envoyer maintenant »', async () => {
    const { racine, fins } = installer()

    await entrerEnEntretien(racine)
    await ecrire(racine, 'et ça me ralentit tous les matins')
    await cliquerEnvoyer(racine)

    expect(fins).toEqual([{ raison: 'envoi', texte: 'et ça me ralentit tous les matins' }])
  })

  it('⛔ le panneau refermé en cours d’entretien marque un abandon, il ne perd rien', async () => {
    const { racine, fins, trouver } = installer()

    await entrerEnEntretien(racine)
    await act(async () => {
      trouver<HTMLButtonElement>('.fermer')!.click()
    })
    await calmer()

    expect(fins).toEqual([{ raison: 'abandon' }])
  })

  it('rouvrir après un abandon donne un panneau NEUF, pas la carte d’un entretien clos', async () => {
    const { racine, trouver } = installer()

    await entrerEnEntretien(racine)
    await act(async () => {
      trouver<HTMLButtonElement>('.fermer')!.click()
    })
    await calmer()
    await ouvrir(racine)

    expect(trouver('.carte')).toBeNull()
    expect(trouver('.question')).toBeNull()
    expect(trouver<HTMLButtonElement>('.envoyer')!.textContent).toContain('Envoyer')
    expect(trouver<HTMLButtonElement>('.envoyer')!.disabled).toBe(true)
  })

  it('la carte reste à l’écran, figée, pendant l’envoi', async () => {
    let libere!: () => void
    const attendue = new Promise<void>((resoudre) => {
      libere = resoudre
    })

    const { racine, trouver } = installer({
      terminer: async () => {
        await attendue
        return true
      },
    })

    await entrerEnEntretien(racine)
    await cliquerEnvoyer(racine)

    const champs = [...trouver('.carte')!.querySelectorAll<HTMLInputElement>('.carte__valeur')]
    expect(champs.length).toBeGreaterThan(0)
    expect(champs.every((champ) => champ.disabled)).toBe(true)

    libere()
    await calmer()
  })

  it('plus rien à demander : on envoie, on ne retient personne', async () => {
    const { racine, fins, trouver } = installer({
      demanderTour: async (): Promise<ResultatTour> => ({
        ok: true,
        tour: { comprehension: CARTE, question: null, motif: 'j’en sais assez' },
      }),
    })

    await entrerEnEntretien(racine)

    expect(fins).toEqual([{ raison: 'envoi' }])
    expect(trouver('.accuse')?.textContent).toContain('C’est parti.')
  })
})

describe('ENVOYÉ — l’accusé', () => {
  it('conclut sur un accusé sobre, puis se ferme', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { racine, trouver } = installer()

    await entrerEnEntretien(racine)
    await cliquerEnvoyer(racine)

    // ⛔ Pas de numéro de suivi, pas de « vous serez notifié ».
    expect(trouver('.accuse')?.textContent).toContain('C’est parti.')
    expect(trouver('.accuse')?.textContent).not.toMatch(/ret_1|suivi|notifi/)

    await act(async () => {
      vi.advanceTimersByTime(2_000)
    })

    expect(trouver('.panneau')).toBeNull()
  })

  it('repart d’un champ vide et sans carte au retour suivant', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { racine, trouver } = installer()

    await entrerEnEntretien(racine, 'quelque chose')
    await cliquerEnvoyer(racine)
    await act(async () => {
      vi.advanceTimersByTime(2_000)
    })
    await ouvrir(racine)

    expect(champDe(racine).value).toBe('')
    expect(trouver('.carte')).toBeNull()
  })
})

describe('L’envoi qui rate', () => {
  it('garde le brouillon, le dit, et ne perd pas un mot', async () => {
    const { racine, trouver } = installer({
      envoyer: async (): Promise<Resultat> => ({
        ok: false,
        message: 'Pas de connexion. Votre retour part dès qu’elle revient.',
        reessayable: true,
      }),
    })

    await ouvrir(racine)
    await ecrire(racine, 'le tri par date se remet à zéro')
    await cliquerEnvoyer(racine)

    expect(champDe(racine).value).toBe('le tri par date se remet à zéro')
    expect(trouver('.avis')?.textContent).toContain('Pas de connexion')
    // L’avis est annoncé, pas seulement affiché.
    expect(trouver('.avis')?.getAttribute('role')).toBe('status')
  })

  // ⚠️ « Il conserve le brouillon en cours et le renvoie à la reconnexion, sans
  //    rien demander » (01-Specs/widget.md §Ce que le widget ne fait jamais).
  it('repart tout seul quand la connexion revient', async () => {
    let enLigne = false
    const envois: CorpsRetour[] = []
    const envoyer = vi.fn(async (corps: CorpsRetour): Promise<Resultat> => {
      envois.push(corps)
      return enLigne ? { ok: true, retour: 'ret_2' } : { ok: false, message: 'hors ligne', reessayable: true }
    })

    const { racine, trouver } = installer({ envoyer, enLigne: () => enLigne })

    await ouvrir(racine)
    await ecrire(racine, 'le tri par date se remet à zéro')
    await cliquerEnvoyer(racine)
    expect(envois).toHaveLength(1)

    enLigne = true
    await act(async () => {
      globalThis.dispatchEvent(new Event('online'))
    })
    await calmer()

    expect(envois).toHaveLength(2)
    expect(envois[1]?.texte).toBe('le tri par date se remet à zéro')
    // Le brouillon est parti, et l’entretien a commencé tout seul.
    expect(champDe(racine).value).toBe('')
    expect(trouver('.carte')).not.toBeNull()
  })
})

describe('window.feedys', () => {
  it('rend de quoi ouvrir et fermer depuis l’hôte', async () => {
    const { montage, racine } = installer()

    await act(async () => {
      montage.commandes.ouvrir()
    })
    expect(racine.querySelector('.panneau')).not.toBeNull()

    await act(async () => {
      montage.commandes.fermer()
    })
    expect(racine.querySelector('.panneau')).toBeNull()
  })
})

/**
 * ⛔ CE BLOC EST CE QUI MANQUAIT.
 *
 * BUGS_LOG 004 §Ce qui l’a laissé passer : « aucun test ne regarde le widget dans
 * l’état ” entretien sans carte “ ». Le test voisin vérifiait bien que la carte
 * n’apparaît pas — il ne regardait pas CE QUE LE CHAMP DIT à ce moment-là.
 *
 * ⚠️ Quatre situations produisent « en entretien, sans carte », et une seule est
 *    un échec. Elles sont toutes ici.
 */
describe('l’invite du champ suit ce qui est À L’ÉCRAN, pas la phase', () => {
  it('⛔ tour en échec : l’invite ne parle plus d’une fiche qui n’existe pas', async () => {
    const { racine, trouver } = installer({
      demanderTour: async (): Promise<ResultatTour> => ({ ok: false }),
    })

    await entrerEnEntretien(racine)

    expect(trouver('.carte')).toBeNull()
    const champ = champDe(racine)
    expect(champ.placeholder).not.toContain('fiche')
    expect(champ.placeholder).toBe('Ajoutez ce qui vous revient.')
  })

  it('⚠️ premier tour encore en vol : même chose, et c’est le CHEMIN NOMINAL', async () => {
    // ⛔ Le défaut 004 n’attendait pas une panne : pendant la latence du modèle,
    //    la phase est déjà à ’entretien’ et la carte n’est pas encore là.
    let relacher: (() => void) | undefined
    const bloquee = new Promise<void>((resoudre) => {
      relacher = resoudre
    })

    const { racine, trouver } = installer({
      demanderTour: async (): Promise<ResultatTour> => {
        await bloquee
        return { ok: false }
      },
    })

    await entrerEnEntretien(racine)

    expect(trouver('.attente')).not.toBeNull()
    expect(trouver('.carte')).toBeNull()
    expect(champDe(racine).placeholder).not.toContain('fiche')

    relacher?.()
  })

  it('question sans carte : on invite à répondre, sans parler de fiche', async () => {
    const { racine, trouver } = installer({
      demanderTour: async (): Promise<ResultatTour> => ({
        ok: true,
        tour: {
          comprehension: null,
          question: 'Je n’ai pas bien saisi — vous pouvez redire ?',
          motif: 'transcript inintelligible',
        },
      }),
    })

    await entrerEnEntretien(racine)

    expect(trouver('.carte')).toBeNull()
    expect(trouver('.question')).not.toBeNull()
    const champ = champDe(racine)
    expect(champ.placeholder).toBe('Répondez, ou ajoutez ce qui vous revient.')
    expect(champ.placeholder).not.toContain('fiche')
  })

  it('✅ carte présente : là, et là seulement, on invite à corriger la fiche', async () => {
    const { racine, trouver } = installer()

    await entrerEnEntretien(racine)

    expect(trouver('.carte')).not.toBeNull()
    expect(champDe(racine).placeholder).toBe('Répondez, ou corrigez la fiche au-dessus.')
  })

  it('avant l’entretien, l’invite est celle de l’accueil', async () => {
    const { racine } = installer()

    await ouvrir(racine)

    const champ = champDe(racine)
    expect(champ.placeholder).toBe('Ce qui vous a bloqué, ou l’idée qui vient de vous venir.')
    expect(champ.getAttribute('aria-label')).toBe('Votre retour')
  })

  it('⚠️ l’aria-label suit la même règle que l’invite', async () => {
    const { racine } = installer({
      demanderTour: async (): Promise<ResultatTour> => ({ ok: false }),
    })

    await entrerEnEntretien(racine)

    expect(champDe(racine).getAttribute('aria-label')).toBe('Votre réponse')
  })
})

describe('ce que le widget dit quand un tour n’aboutit pas', () => {
  it('⛔ ne laisse plus l’écran MUET — on cliquait, il ne se passait rien', async () => {
    const { racine, trouver } = installer({
      demanderTour: async (): Promise<ResultatTour> => ({ ok: false }),
    })

    await entrerEnEntretien(racine)

    const avis = trouver('.avis')!
    expect(avis.textContent).toBe('C’est noté. Ajoutez ce que vous voulez, ou envoyez.')
    expect(avis.getAttribute('role')).toBe('status')
  })

  it('⛔ n’explique pas ce qui manque, ne s’excuse pas, ne promet rien', async () => {
    const { racine, trouver } = installer({
      demanderTour: async (): Promise<ResultatTour> => ({ ok: false }),
    })

    await entrerEnEntretien(racine)

    const dit = `${trouver('.avis')?.textContent ?? ''} ${champDe(racine).placeholder}`.toLowerCase()
    for (const interdit of ['désol', 'excus', 'erreur', 'indisponible', 'panne', 'réessay', 'bientôt', 'bug']) {
      expect(dit).not.toContain(interdit)
    }
  })

  it('l’avis disparaît dès que le tour suivant part', async () => {
    let premier = true
    const { racine, trouver } = installer({
      demanderTour: async (): Promise<ResultatTour> => {
        if (premier) {
          premier = false
          return { ok: false }
        }
        return {
          ok: true,
          tour: { comprehension: CARTE, question: 'Et sur quel écran ?', motif: 'il manque l’écran' },
        }
      },
    })

    await entrerEnEntretien(racine)
    expect(trouver('.avis')?.textContent).not.toBe('')

    await ecrire(racine, 'sur la liste des dossiers')
    await cliquerRepondre(racine)

    expect(trouver('.avis')?.textContent).toBe('')
    expect(trouver('.carte')).not.toBeNull()
  })

  it('⛔ une question vide n’est pas une question — rien n’est rendu', async () => {
    const { racine, trouver } = installer({
      demanderTour: async (): Promise<ResultatTour> => ({
        ok: true,
        tour: { comprehension: CARTE, question: '   ', motif: 'question vide' },
      }),
    })

    await entrerEnEntretien(racine)

    expect(trouver('.question')).toBeNull()
  })
})

/**
 * ⛔ CE QUE LA RELECTURE DE P-017 A TROUVÉ, ET QUE PERSONNE NE VOYAIT.
 *
 * ⚠️ Ces quatre défauts ont un point commun : ils ne se manifestent qu’à la
 *    RÉOUVERTURE du panneau, ou pendant les quelques secondes d’une requête. Ni
 *    la recette manuelle, ni les parcours ne s’attardent là.
 */
describe('l’écran ne garde rien de l’entretien précédent', () => {
  /** Une promesse qu’on résout à la main : c’est comme ça qu’on tient un tour en vol. */
  function differe<T>(): { promesse: Promise<T>; resoudre: (valeur: T) => void } {
    let resoudre!: (valeur: T) => void
    const promesse = new Promise<T>((r) => {
      resoudre = r
    })
    return { promesse, resoudre }
  }

  const TOUR_MUET = { ok: false } as const

  it('⛔ l’avis d’un tour en échec ne survit pas à l’accusé', async () => {
    const { racine, trouver } = installer({ demanderTour: async () => TOUR_MUET })

    await entrerEnEntretien(racine)
    expect(trouver('.avis')?.textContent).toContain('C’est noté.')

    vi.useFakeTimers()
    await cliquerEnvoyer(racine)
    await act(async () => {
      vi.advanceTimersByTime(3_000)
    })
    await calmer()
    vi.useRealTimers()

    // ⛔ On rouvre pour signaler AUTRE CHOSE : le panneau doit être vierge.
    await ouvrir(racine)
    expect(trouver('.avis')?.textContent).toBe('')
  })

  it('⛔ un tour qui revient APRÈS la fermeture ne pose ni carte ni question', async () => {
    const attendu = differe<ResultatTour>()
    const { racine, trouver } = installer({ demanderTour: () => attendu.promesse })

    await entrerEnEntretien(racine)
    // Le tour est en vol. La personne referme le panneau : c’est un abandon.
    await act(async () => {
      trouver<HTMLButtonElement>('.fermer')!.click()
    })
    await calmer()

    // ⚠️ Et SEULEMENT MAINTENANT, le modèle répond.
    await act(async () => {
      attendu.resoudre({
        ok: true,
        tour: { comprehension: CARTE, question: 'C’est nouveau ?', motif: 'la récurrence' },
      })
    })
    await calmer()

    await ouvrir(racine)

    // ⛔ Sinon : la fiche ET la question d’un entretien clos réapparaissaient
    //    sur un panneau d’accueil, sous une invite qui n’en parle pas — le
    //    défaut 004 dans l’autre sens.
    expect(trouver('.carte')).toBeNull()
    expect(trouver('.question')).toBeNull()
    expect(champDe(racine).placeholder).toBe('Ce qui vous a bloqué, ou l’idée qui vient de vous venir.')
  })

  it('⛔ un tour qui ÉCHOUE après la fermeture ne pose pas son avis non plus', async () => {
    const attendu = differe<ResultatTour>()
    const { racine, trouver } = installer({ demanderTour: () => attendu.promesse })

    await entrerEnEntretien(racine)
    await act(async () => {
      trouver<HTMLButtonElement>('.fermer')!.click()
    })
    await calmer()

    await act(async () => {
      attendu.resoudre(TOUR_MUET)
    })
    await calmer()

    await ouvrir(racine)
    expect(trouver('.avis')?.textContent).toBe('')
  })

  it('⛔ ne laisse pas « Un instant… » collé sur le panneau suivant', async () => {
    const attendu = differe<ResultatTour>()
    const { racine, trouver } = installer({ demanderTour: () => attendu.promesse })

    await entrerEnEntretien(racine)
    expect(trouver('.attente')?.textContent).toContain('Un instant')

    await act(async () => {
      trouver<HTMLButtonElement>('.fermer')!.click()
    })
    await calmer()
    await ouvrir(racine)

    expect(trouver('.attente')).toBeNull()
  })
})

describe('l’invite du champ pendant que la requête tourne', () => {
  it('⛔ ne repasse pas à l’invite d’accueil tant que la fiche est à l’écran', async () => {
    let resoudre!: (valeur: boolean) => void
    const terminer = () =>
      new Promise<boolean>((r) => {
        resoudre = r
      })

    const { racine } = installer({ terminer })

    await entrerEnEntretien(racine)
    const champ = champDe(racine)
    expect(champ.placeholder).toBe('Répondez, ou corrigez la fiche au-dessus.')

    // « Envoyer maintenant » : la carte est DÉLIBÉRÉMENT maintenue à l’écran,
    // figée, le temps de la requête.
    await cliquerEnvoyer(racine)

    // ⛔ Pendant tout ce temps — plusieurs secondes sur un réseau lent — le champ
    //    repassait à « Ce qui vous a bloqué… » et l’aria-label de « Votre
    //    réponse » à « Votre retour », SOUS une fiche toujours affichée.
    expect(racine.querySelector('.carte')).not.toBeNull()
    expect(champDe(racine).placeholder).toBe('Répondez, ou corrigez la fiche au-dessus.')
    expect(champDe(racine).getAttribute('aria-label')).toBe('Votre réponse')

    resoudre(true)
    await calmer()
  })
})

describe('une question blanche', () => {
  /**
   * ⛔ Le serveur normalise, donc le cas est rare. Mais le widget se protégeait
   *    déjà à l’AFFICHAGE et pas à la conclusion : le `<p class="question">`
   *    n’était pas rendu, et `conclure('envoi')` n’était jamais déclenché.
   *    L’entretien restait ouvert indéfiniment, fiche à l’écran, invitant à
   *    répondre à rien.
   */
  it('⛔ conclut l’entretien au lieu de le laisser ouvert pour toujours', async () => {
    const { racine, terminer, trouver } = installer({
      demanderTour: async () => ({
        ok: true,
        tour: { comprehension: CARTE, question: '   ', motif: 'aucun' },
      }),
    })

    await entrerEnEntretien(racine)

    expect(trouver('.question')).toBeNull()
    expect(terminer).toHaveBeenCalledOnce()
    expect(terminer.mock.calls[0]?.[1]).toMatchObject({ raison: 'envoi' })
  })
})
