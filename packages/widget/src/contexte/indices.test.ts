/**
 * Le collecteur d’indices — et surtout ce qu’il refuse de relever.
 *
 * ⚠️ La moitié de ces tests vérifie une ABSENCE. C’est voulu : ce module est
 *    acceptable chez un hôte à cause de ce qu’il ne fait pas, et une absence
 *    qui n’est pas testée est une absence qui redevient vraie un jour où
 *    quelqu’un trouvera pratique de joindre le message d’erreur (D-026).
 */
import { describe, expect, it, vi } from 'vitest'

import { INDICES_MAX } from '../transport'

import { lireIndicePousse, normaliserChemin, premiereTrame, suivreIndices } from './indices'

/** Une fausse fenêtre : deux registres d’écouteurs, et rien d’autre. */
function fenetreDEssai(pathname = '/dossiers') {
  const ecouteurs = new Map<string, ((evenement: unknown) => void)[]>()

  const fenetre = {
    location: { pathname },
    addEventListener: (nom: string, gestionnaire: (evenement: unknown) => void) => {
      ecouteurs.set(nom, [...(ecouteurs.get(nom) ?? []), gestionnaire])
    },
    removeEventListener: (nom: string, gestionnaire: (evenement: unknown) => void) => {
      ecouteurs.set(nom, (ecouteurs.get(nom) ?? []).filter((g) => g !== gestionnaire))
    },
  } as unknown as Window

  const emettre = (nom: string, evenement: unknown): void => {
    for (const gestionnaire of ecouteurs.get(nom) ?? []) gestionnaire(evenement)
  }

  return { fenetre, emettre, ecouteurs, aller: (vers: string) => ((fenetre.location as { pathname: string }).pathname = vers) }
}

function erreurAvecPile(nom: string, message: string, trame: string): Error {
  const erreur = new Error(message)
  erreur.name = nom
  erreur.stack = `${nom}: ${message}\n    at ${trame}\n    at autreChose (autre.js:1:1)`
  return erreur
}

describe('normaliserChemin', () => {
  it('remplace les segments identifiants — le chemin est une adresse, pas une donnée', () => {
    // ⛔ Sans ça, le numéro de dossier partirait en base et dans un email.
    expect(normaliserChemin('https://victoria.exemple.fr/api/dossiers/4417/valider')).toBe(
      '/api/dossiers/:id/valider',
    )
    expect(normaliserChemin('https://x.fr/api/clients/clx7f2k9m3p1q5r7t9v1w3y5')).toBe(
      '/api/clients/:id',
    )
    expect(
      normaliserChemin('https://x.fr/api/a/550e8400-e29b-41d4-a716-446655440000/b'),
    ).toBe('/api/a/:id/b')
  })

  it('retire la requête ENTIÈREMENT — ce qu’on ne garde pas ne peut pas fuir', () => {
    expect(normaliserChemin('https://x.fr/api/recherche?nom=Dupont&token=abc')).toBe(
      '/api/recherche',
    )
  })

  it('rend undefined sur du vide, et un chemin borné sur n’importe quoi d’autre', () => {
    expect(normaliserChemin('')).toBeUndefined()
    expect(normaliserChemin('   ')).toBeUndefined()

    // ⚠️ Une saisie absurde poussée par un hôte ne rend pas `undefined` — elle
    //    rend un CHEMIN, parce qu’une base de secours la résout. Ce qui compte
    //    n’est pas qu’elle soit jolie, c’est qu’elle ne porte plus de requête
    //    et que l’origine de secours ne ressorte jamais.
    const absurde = normaliserChemin('pas une url?token=abc')
    expect(absurde).not.toContain('?')
    expect(absurde).not.toContain('indice.invalid')
    expect(absurde).not.toContain('token')
  })
})

describe('premiereTrame', () => {
  it('rend la première trame, sans la ligne de message qui la précède', () => {
    const pile = 'TypeError: le dossier de M. Dupont est verrouillé\n    at valider (app.js:12:34)\n    at b (c.js:1:1)'

    // ⛔ LE TEST QUI COMPTE : le nom du dossier et celui de la personne sont
    //    dans la ligne de message, et elle ne sort pas.
    expect(premiereTrame(pile)).toBe('valider (app.js:12:34)')
    expect(premiereTrame(pile)).not.toContain('Dupont')
  })

  it('rend undefined quand il n’y a aucune trame — un message seul ne sort pas', () => {
    expect(premiereTrame('TypeError: quelque chose de confidentiel')).toBeUndefined()
    expect(premiereTrame(undefined)).toBeUndefined()
    expect(premiereTrame(42)).toBeUndefined()
  })
})

describe('suivreIndices — le relevé passif', () => {
  it('relève le NOM et la trame d’une exception, jamais son message', () => {
    const { fenetre, emettre } = fenetreDEssai()
    const indices = suivreIndices({ fenetre })

    emettre('error', {
      error: erreurAvecPile('TypeError', 'Le dossier de M. Dupont est verrouillé', 'valider (app.js:12:34)'),
    })

    const releves = indices.derniers()
    expect(releves).toHaveLength(1)
    expect(releves[0]).toMatchObject({
      genre: 'js',
      nom: 'TypeError',
      trame: 'valider (app.js:12:34)',
    })

    // ⛔ L’INVARIANT DU MODULE, vérifié sur la sérialisation entière : aucun
    //    champ, quel qu’il soit, ne porte le message.
    expect(JSON.stringify(releves)).not.toContain('Dupont')
    expect(JSON.stringify(releves)).not.toContain('verrouillé')
  })

  it('relève aussi les rejets de promesse non traités', () => {
    const { fenetre, emettre } = fenetreDEssai()
    const indices = suivreIndices({ fenetre })

    emettre('unhandledrejection', { reason: erreurAvecPile('AbortError', 'secret', 'charger (api.js:3:9)') })

    expect(indices.derniers()[0]).toMatchObject({ genre: 'js', nom: 'AbortError' })
  })

  /**
   * ⛔ SANS CE FILTRE, LE PREMIER INDICE AFFICHÉ SERAIT FEEDYS ACCUSANT FEEDYS.
   *    `snapdom` écrit déjà dans la console de l’hôte (T-005), et une exception
   *    levée dans notre bundle n’apprend rien sur le logiciel métier.
   */
  it('jette ce qui vient de chez nous', () => {
    const { fenetre, emettre } = fenetreDEssai()
    const indices = suivreIndices({ fenetre, origineFeedys: 'https://feedys.exemple.fr' })

    emettre('error', {
      error: erreurAvecPile('TypeError', 'x', 'snap (https://feedys.exemple.fr/snapdom.js:1:1)'),
    })
    emettre('error', {
      error: erreurAvecPile('RangeError', 'x', 'valider (https://victoria.exemple.fr/app.js:1:1)'),
    })

    const releves = indices.derniers()
    expect(releves).toHaveLength(1)
    expect(releves[0]?.nom).toBe('RangeError')
  })

  it('ne garde que les trois derniers — un journal ne se lit pas dans une fiche', () => {
    const { fenetre, emettre } = fenetreDEssai()
    const indices = suivreIndices({ fenetre })

    for (const nom of ['A', 'B', 'C', 'D', 'E']) {
      emettre('error', { error: erreurAvecPile(`${nom}Error`, 'x', 'f (a.js:1:1)') })
    }

    const releves = indices.derniers()
    expect(releves).toHaveLength(INDICES_MAX)
    // ⚠️ Les DERNIERS : le plus récent est le plus probable.
    expect(releves.map((i) => i.nom)).toEqual(['CError', 'DError', 'EError'])
  })

  /**
   * ⛔ LE TEST QUI DIT POURQUOI LA FENÊTRE DE 60 SECONDES ÉTAIT LE MAUVAIS AXE.
   *    Un poste de bureau garde un onglet ouvert huit heures. Ce qui borne, ce
   *    n’est pas l’âge — c’est l’écran (D-026).
   */
  it('borne par l’écran, pas par la durée', () => {
    const { fenetre, emettre, aller } = fenetreDEssai('/factures')
    let horloge = 0
    const indices = suivreIndices({ fenetre, maintenant: () => horloge })

    emettre('error', { error: erreurAvecPile('FactureError', 'x', 'f (a.js:1:1)') })

    // Deux heures plus tard, toujours sur le même écran : on garde, et on date.
    horloge = 2 * 3600 * 1000
    expect(indices.derniers()).toHaveLength(1)
    expect(indices.derniers()[0]?.ecartMs).toBe(7_200_000)

    // Un autre écran : ce qui s’est passé sur le précédent ne parle pas de
    // celui-ci.
    aller('/dossiers')
    expect(indices.derniers()).toHaveLength(0)
  })

  it('date chaque indice à la LECTURE, pas au relevé', () => {
    const { fenetre, emettre } = fenetreDEssai()
    let horloge = 1_000
    const indices = suivreIndices({ fenetre, maintenant: () => horloge })

    emettre('error', { error: erreurAvecPile('TypeError', 'x', 'f (a.js:1:1)') })

    horloge = 6_000
    expect(indices.derniers()[0]?.ecartMs).toBe(5_000)
    horloge = 11_000
    expect(indices.derniers()[0]?.ecartMs).toBe(10_000)
  })

  it('n’écrase pas le gestionnaire de l’hôte — addEventListener, jamais onerror', () => {
    const { fenetre, ecouteurs } = fenetreDEssai()
    const avant = { ...(fenetre as unknown as Record<string, unknown>) }

    suivreIndices({ fenetre })

    // ⛔ `window.onerror` n’est jamais assigné : beaucoup d’applications métier
    //    posent le leur, et l’écraser serait invisible et destructeur.
    expect((fenetre as unknown as { onerror?: unknown }).onerror).toBe(avant['onerror'])
    expect(ecouteurs.get('error')).toHaveLength(1)
    expect(ecouteurs.get('unhandledrejection')).toHaveLength(1)
  })

  it('détache tout à l’arrêt — un widget démonté n’écoute plus', () => {
    const { fenetre, emettre, ecouteurs } = fenetreDEssai()
    const indices = suivreIndices({ fenetre })

    indices.arreter()
    emettre('error', { error: erreurAvecPile('TypeError', 'x', 'f (a.js:1:1)') })

    expect(ecouteurs.get('error')).toHaveLength(0)
    expect(indices.derniers()).toHaveLength(0)
  })

  it('ne lève jamais, même sur une fenêtre hostile', () => {
    const hostile = {
      get location() {
        throw new Error('non')
      },
      addEventListener: () => {
        throw new Error('non plus')
      },
      removeEventListener: () => {},
    } as unknown as Window

    const indices = suivreIndices({ fenetre: hostile })
    expect(() => indices.derniers()).not.toThrow()
    expect(() => indices.poser({ genre: 'js', nom: 'X' })).not.toThrow()
    expect(() => indices.arreter()).not.toThrow()
  })
})

describe('suivreIndices — ce que l’hôte pousse', () => {
  it('accepte un indice poussé, avec sa référence de corrélation', () => {
    const { fenetre } = fenetreDEssai()
    const indices = suivreIndices({ fenetre })

    indices.poser({ genre: 'js', nom: 'TypeError', reference: 'a1b2c3d4e5f6' })

    expect(indices.derniers()[0]).toMatchObject({
      genre: 'js',
      nom: 'TypeError',
      reference: 'a1b2c3d4e5f6',
    })
  })

  it('normalise le chemin d’un indice poussé comme celui d’un indice relevé', () => {
    const { fenetre } = fenetreDEssai()
    const indices = suivreIndices({ fenetre })

    indices.poser({ genre: 'http', statut: 500, chemin: '/api/dossiers/4417/valider', methode: 'post' })

    expect(indices.derniers()[0]).toMatchObject({
      genre: 'http',
      statut: 500,
      chemin: '/api/dossiers/:id/valider',
      methode: 'POST',
    })
  })

  it('ne garde d’une pile poussée que sa première trame', () => {
    // ⚠️ Un hôte qui pousse `error.stack` entier — 40 Ko et la ligne de
    //    message en tête — n’en voit sortir que la trame.
    const pousse = lireIndicePousse({
      genre: 'js',
      nom: 'TypeError',
      trame: 'TypeError: M. Dupont\n    at valider (app.js:1:2)\n    at x (y.js:3:4)',
    })

    expect(pousse?.trame).toBe('valider (app.js:1:2)')
    expect(JSON.stringify(pousse)).not.toContain('Dupont')
  })
})

/**
 * ⛔ TOUT CE QUI SUIT EST DU CODE DE QUELQU’UN D’AUTRE QUI APPELLE. Un objet mal
 *    formé ne doit produire NI exception, NI champ hors contrat : le serveur
 *    refuserait le retour entier, et on perdrait une parole pour une erreur
 *    d’intégration chez l’hôte.
 */
describe('lireIndicePousse — rien n’est cru sur parole', () => {
  it('jette ce qui n’est pas un objet', () => {
    for (const brut of [null, undefined, 42, 'TypeError', [], true]) {
      expect(lireIndicePousse(brut)).toBeUndefined()
    }
  })

  it('jette un genre inventé', () => {
    expect(lireIndicePousse({ genre: 'console', nom: 'X' })).toBeUndefined()
    expect(lireIndicePousse({ nom: 'X' })).toBeUndefined()
  })

  it('exige le nom d’un js, le statut ET le chemin d’un http', () => {
    expect(lireIndicePousse({ genre: 'js' })).toBeUndefined()
    expect(lireIndicePousse({ genre: 'http', statut: 500 })).toBeUndefined()
    expect(lireIndicePousse({ genre: 'http', chemin: '/api' })).toBeUndefined()
    expect(lireIndicePousse({ genre: 'http', statut: 'cinq cents', chemin: '/api' })).toBeUndefined()
    expect(lireIndicePousse({ genre: 'http', statut: 700, chemin: '/api' })).toBeUndefined()
  })

  it('jette une méthode inventée plutôt que d’écrire n’importe quoi', () => {
    const indice = lireIndicePousse({ genre: 'http', statut: 500, chemin: '/api', methode: 'BOIRE' })
    expect(indice).toMatchObject({ genre: 'http' })
    expect(indice?.methode).toBeUndefined()
  })

  it('borne ce qui est trop long plutôt que de le laisser refuser par le serveur', () => {
    const indice = lireIndicePousse({
      genre: 'js',
      nom: 'X'.repeat(500),
      reference: 'r'.repeat(500),
    })

    expect(indice?.nom?.length).toBe(120)
    expect(indice?.reference?.length).toBe(200)
  })

  it('⛔ n’a aucun champ où poser un message, même si l’hôte en pousse un', () => {
    const indice = lireIndicePousse({
      genre: 'js',
      nom: 'TypeError',
      message: 'Le dossier de M. Dupont est verrouillé',
    } as unknown)

    expect(indice).toMatchObject({ genre: 'js', nom: 'TypeError' })
    expect(JSON.stringify(indice)).not.toContain('Dupont')
    expect(Object.keys(indice ?? {})).not.toContain('message')
  })
})

describe('suivreIndices — les requêtes, sans toucher à fetch', () => {
  /**
   * ⛔ LE TEST QUI DIT POURQUOI ON N’ENVELOPPE PAS `fetch`. Envelopper le
   *    `fetch` de son hôte quand on est un invité, c’est entrer dans sa chaîne
   *    de wrappers et devenir le suspect n°1 de son prochain bug.
   */
  it('ne remplace ni fetch ni XMLHttpRequest', () => {
    const fetchOrigine = vi.fn()
    const fenetre = {
      location: { pathname: '/x' },
      addEventListener: () => {},
      removeEventListener: () => {},
      fetch: fetchOrigine,
      XMLHttpRequest: class {},
    } as unknown as Window

    const xhrOrigine = (fenetre as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest

    suivreIndices({ fenetre })

    expect((fenetre as unknown as { fetch: unknown }).fetch).toBe(fetchOrigine)
    expect((fenetre as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest).toBe(xhrOrigine)
  })

  it('relève les requêtes en erreur vues par PerformanceObserver', () => {
    let rappel: ((liste: { getEntries: () => unknown[] }) => void) | undefined

    const fenetre = {
      location: { pathname: '/dossiers' },
      addEventListener: () => {},
      removeEventListener: () => {},
      PerformanceObserver: class {
        constructor(recu: (liste: { getEntries: () => unknown[] }) => void) {
          rappel = recu
        }
        observe() {}
        disconnect() {}
      },
    } as unknown as Window

    const indices = suivreIndices({ fenetre, origineFeedys: 'https://feedys.exemple.fr' })

    rappel?.({
      getEntries: () => [
        // ⛔ Sous 400 : ce n’est pas un indice.
        { name: 'https://victoria.exemple.fr/api/ok', responseStatus: 200 },
        // ⛔ Chez nous : pas un indice sur le logiciel de l’hôte.
        { name: 'https://feedys.exemple.fr/api/retours', responseStatus: 500 },
        // ⚠️ Sans `responseStatus` — un navigateur qui ne le donne pas.
        { name: 'https://victoria.exemple.fr/api/muet' },
        { name: 'https://victoria.exemple.fr/api/dossiers/4417/valider', responseStatus: 500 },
      ],
    })

    const releves = indices.derniers()
    expect(releves).toHaveLength(1)
    expect(releves[0]).toMatchObject({
      genre: 'http',
      statut: 500,
      chemin: '/api/dossiers/:id/valider',
    })
    // ⚠️ Une limite honnête : `PerformanceObserver` ne donne pas la méthode.
    expect(releves[0]?.methode).toBeUndefined()
  })

  it('se passe de PerformanceObserver sans rien casser', () => {
    const { fenetre, emettre } = fenetreDEssai()
    const indices = suivreIndices({ fenetre })

    emettre('error', { error: erreurAvecPile('TypeError', 'x', 'f (a.js:1:1)') })
    expect(indices.derniers()).toHaveLength(1)
  })
})
