/**
 * La boucle d’entretien, exercée avec un bouchon — sans clé d’API, sans base,
 * hors ligne.
 *
 * ⛔ Les deux propriétés que ce fichier existe pour prouver :
 *    1. une TROISIÈME relance est impossible, même en forgeant la requête ;
 *    2. aucun mode de défaillance ne perd le retour.
 */
import { describe, expect, it, vi } from 'vitest'

import { SchemaTourRendu } from '../../../../packages/widget/src/contrat'

import type { TourEntretien } from './modele'
import { modeleBouchon } from './modele'
import type { TourFil } from './prompts'
import type {
  EntretienCharge,
  MessageAEcrire,
  PortDepotEntretien,
  PortsTour,
} from './tour'
import { MAX_RELANCES, RELANCE_INAUDIBLE, borner, jouerTour, relancesPosees, terminerEntretien } from './tour'

const CLE = 'fdy_pub_essai'
const PRODUIT = 'produit-1'
const RETOUR = 'retour-1'

/** ⚠️ Écrit à la main. ⛔ Jamais un vrai retour copié d’une base (CLAUDE.md §Secrets). */
const PAROLE =
  'alors euh le tri par date là sur la liste des dossiers dès que je reviens en arrière il se remet à zéro'

interface Base {
  readonly depot: PortDepotEntretien
  readonly ecrits: MessageAEcrire[]
  readonly clotures: string[]
}

function baseAvec(fil: readonly TourFil[], statut = 'en_cours'): Base {
  const ecrits: MessageAEcrire[] = []
  const clotures: string[] = []
  let etat: EntretienCharge = {
    statut,
    contexte: { url: 'https://logiciel.exemple.fr/dossiers', ecran: 'Liste des dossiers' },
    fil: [...fil],
    prochainOrdre: fil.length,
  }

  return {
    ecrits,
    clotures,
    depot: {
      charger: (retourId, produitId) =>
        Promise.resolve(retourId === RETOUR && produitId === PRODUIT ? etat : null),
      ecrire: (_retourId, messages) => {
        ecrits.push(...messages)
        etat = {
          ...etat,
          fil: [...etat.fil, ...messages.map(({ role, texte }) => ({ role, texte }))],
          prochainOrdre: etat.prochainOrdre + messages.length,
        }
        return Promise.resolve()
      },
      clore: (_retourId, nouveau) => {
        clotures.push(nouveau)
        etat = { ...etat, statut: nouveau }
        return Promise.resolve()
      },
    },
  }
}

function portsAvec(base: Base, modele: PortsTour['modele']): PortsTour {
  return {
    depot: base.depot,
    produits: {
      produitParCle: (cle) =>
        Promise.resolve(
          cle === CLE ? { id: PRODUIT, domaine: 'logiciel.exemple.fr', actif: true, secret: null } : null,
        ),
    },
    modele,
    debitParCle: { autoriser: () => true },
    debitParIp: { autoriser: () => true },
    maintenant: () => 0,
  }
}

const ACCES = { retourId: RETOUR, cle: CLE, origine: null, ip: '10.0.0.1' } as const

function tourAvecQuestion(question: string | null): TourEntretien {
  return {
    comprehension: {
      type: 'bug',
      titre: 'Le tri par date se réinitialise au retour sur la page',
      resume: 'La personne repose le tri à chaque navigation.',
      ecran: 'Liste des dossiers',
    },
    question,
    motif: 'La récurrence change ce qu’un développeur ferait.',
  }
}

describe('⛔ deux relances au maximum, et le verrou est côté serveur', () => {
  it('compte une relance par ligne `bot` du fil, et rien d’autre', () => {
    expect(
      relancesPosees([
        { role: 'collaborateur', texte: PAROLE },
        { role: 'bot', texte: 'C’est nouveau ?' },
        { role: 'collaborateur', texte: 'non' },
      ]),
    ).toBe(1)
  })

  it('pose la première relance et l’écrit au fil', async () => {
    const base = baseAvec([{ role: 'collaborateur', texte: PAROLE }])
    const modele = modeleBouchon({ tours: [tourAvecQuestion('C’est nouveau ?')] })

    const resultat = await jouerTour(ACCES, portsAvec(base, modele))

    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.tour.question).toBe('C’est nouveau ?')
    expect(base.ecrits.filter((m) => m.role === 'bot')).toHaveLength(1)
    expect(base.ecrits.at(-1)?.motif).toBe('La récurrence change ce qu’un développeur ferait.')
  })

  it('⛔ JETTE la troisième question, même si le modèle en produit une', async () => {
    const base = baseAvec([
      { role: 'collaborateur', texte: PAROLE },
      { role: 'bot', texte: 'C’est nouveau ?' },
      { role: 'collaborateur', texte: 'non ça a toujours fait ça' },
      { role: 'bot', texte: 'Ça vous bloque ou ça vous ralentit ?' },
      { role: 'collaborateur', texte: 'ça me ralentit' },
    ])
    const modele = modeleBouchon({ tours: [tourAvecQuestion('Et sur les autres listes ?')] })

    const resultat = await jouerTour(ACCES, portsAvec(base, modele))

    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.tour.question).toBeNull()
    // ⛔ Aucune ligne `bot` de plus : une troisième relance n’existe pas.
    expect(base.ecrits.filter((m) => m.role === 'bot')).toHaveLength(0)
    // ⚠️ La carte, elle, est bien à jour : la dernière réponse compte.
    expect(resultat.tour.comprehension?.titre).toContain('tri par date')
  })

  it('⛔ forger la requête n’y change rien : le compte se fait sur le fil, pas sur le corps', async () => {
    const base = baseAvec([
      { role: 'collaborateur', texte: PAROLE },
      { role: 'bot', texte: 'une' },
      { role: 'collaborateur', texte: 'oui' },
      { role: 'bot', texte: 'deux' },
    ])
    const modele = modeleBouchon({ tours: [tourAvecQuestion('trois')] })

    // Un corps forgé au maximum de ce que le contrat autorise.
    const resultat = await jouerTour(
      { ...ACCES, texte: 'réponse', transcriptBrut: 'réponse', corrections: 'Écran — autre' },
      portsAvec(base, modele),
    )

    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.tour.question).toBeNull()
    expect(modele.recues.at(-1)?.relancesRestantes).toBe(0)
  })

  it('dit au modèle combien il lui en reste, à chaque tour', async () => {
    const base = baseAvec([{ role: 'collaborateur', texte: PAROLE }])
    const modele = modeleBouchon({ tours: [tourAvecQuestion('C’est nouveau ?')] })

    await jouerTour(ACCES, portsAvec(base, modele))

    expect(modele.recues[0]?.relancesRestantes).toBe(MAX_RELANCES)
  })

  it('`borner` est le verrou lui-même : à zéro restante, la question tombe', () => {
    expect(borner(tourAvecQuestion('encore une ?'), 0).question).toBeNull()
    expect(borner(tourAvecQuestion('encore une ?'), 1).question).toBe('encore une ?')
  })
})

describe('⛔ aucun mode de défaillance ne perd le retour', () => {
  it('modèle muet : refus temporaire, et RIEN n’est écrit ni clos', async () => {
    const base = baseAvec([{ role: 'collaborateur', texte: PAROLE }])
    const signaler = vi.fn()

    const resultat = await jouerTour(ACCES, {
      ...portsAvec(base, modeleBouchon({ echoue: true })),
      signaler,
    })

    expect(resultat).toEqual({
      ok: false,
      motif: 'modele_indisponible',
      message: expect.stringContaining('enregistré'),
    })
    expect(base.clotures).toEqual([])
    expect(signaler).toHaveBeenCalledOnce()
  })

  it('modèle muet : « Envoyer » fonctionne quand même, et le retour part', async () => {
    const base = baseAvec([{ role: 'collaborateur', texte: PAROLE }])
    const ports = portsAvec(base, modeleBouchon({ echoue: true }))

    await jouerTour(ACCES, ports)
    const fin = await terminerEntretien({ ...ACCES, raison: 'envoi' }, ports)

    expect(fin).toEqual({ ok: true, statut: 'envoye' })
    expect(base.clotures).toEqual(['envoye'])
  })

  it('transcript vide : UNE seule relance, écrite ici et pas demandée au modèle', async () => {
    const base = baseAvec([{ role: 'collaborateur', texte: '' }])
    const modele = modeleBouchon()

    const resultat = await jouerTour(ACCES, portsAvec(base, modele))

    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.tour.question).toBe(RELANCE_INAUDIBLE)
    // ⛔ Pas de carte : une compréhension fabriquée sur du vide serait un mensonge.
    expect(resultat.tour.comprehension).toBeNull()
    expect(modele.recues).toHaveLength(0)
  })

  it('transcript encore vide après la relance : on s’arrête, on n’insiste pas', async () => {
    const base = baseAvec([
      { role: 'collaborateur', texte: '' },
      { role: 'bot', texte: RELANCE_INAUDIBLE },
    ])
    const modele = modeleBouchon()

    const resultat = await jouerTour(ACCES, portsAvec(base, modele))

    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.tour.question).toBeNull()
    expect(modele.recues).toHaveLength(0)
  })

  it('abandon : le retour est conservé et marqué `abandonne`, pas perdu', async () => {
    const base = baseAvec([{ role: 'collaborateur', texte: PAROLE }])

    const fin = await terminerEntretien(
      { ...ACCES, raison: 'abandon' },
      portsAvec(base, modeleBouchon()),
    )

    expect(fin).toEqual({ ok: true, statut: 'abandonne' })
    expect(base.clotures).toEqual(['abandonne'])
  })

  it('un abandon qui arrive APRÈS un envoi ne défait rien — la course est normale', async () => {
    const base = baseAvec([{ role: 'collaborateur', texte: PAROLE }])
    const ports = portsAvec(base, modeleBouchon())

    await terminerEntretien({ ...ACCES, raison: 'envoi' }, ports)
    const tardif = await terminerEntretien({ ...ACCES, raison: 'abandon' }, ports)

    expect(tardif).toEqual({ ok: true, statut: 'envoye' })
    expect(base.clotures).toEqual(['envoye'])
  })

  it('la réponse est ÉCRITE avant l’appel au modèle : un modèle muet ne l’efface pas', async () => {
    const base = baseAvec([{ role: 'collaborateur', texte: PAROLE }])

    await jouerTour({ ...ACCES, texte: 'non ça a toujours fait ça' }, {
      ...portsAvec(base, modeleBouchon({ echoue: true })),
      signaler: () => {},
    })

    expect(base.ecrits.map((m) => m.texte)).toContain('non ça a toujours fait ça')
  })

  it('l’échec de l’aval ne défait pas la clôture', async () => {
    const base = baseAvec([{ role: 'collaborateur', texte: PAROLE }])
    const signaler = vi.fn()

    const fin = await terminerEntretien({ ...ACCES, raison: 'envoi' }, {
      ...portsAvec(base, modeleBouchon()),
      aval: () => Promise.reject(new Error('la synthèse a échoué')),
      signaler,
    })

    expect(fin).toEqual({ ok: true, statut: 'envoye' })
    expect(base.clotures).toEqual(['envoye'])
    expect(signaler).toHaveBeenCalledOnce()
  })
})

describe('les corrections de la carte', () => {
  it('entrent dans le fil comme ce qu’elles sont : la personne qui reprend le bot', async () => {
    const base = baseAvec([{ role: 'collaborateur', texte: PAROLE }])

    await jouerTour(
      { ...ACCES, corrections: 'Écran — Liste des mandats', texte: 'et c’est tous les jours' },
      portsAvec(base, modeleBouchon()),
    )

    const apportes = base.ecrits.filter((m) => m.role === 'collaborateur')

    expect(apportes.map((m) => m.texte)).toEqual([
      'Correction · Écran — Liste des mandats',
      'et c’est tous les jours',
    ])
    // ⚠️ La correction AVANT la réponse : c’est l’ordre de l’écran.
    expect(apportes.map((m) => m.ordre)).toEqual([1, 2])
    // ⚠️ Et la question du bot vient après, sans écraser personne.
    expect(base.ecrits.at(-1)).toMatchObject({ role: 'bot', ordre: 3 })
  })

  it('une correction envoyée avec la fin n’est pas perdue', async () => {
    const base = baseAvec([{ role: 'collaborateur', texte: PAROLE }])

    await terminerEntretien(
      { ...ACCES, raison: 'envoi', corrections: 'Type — une idée' },
      portsAvec(base, modeleBouchon()),
    )

    expect(base.ecrits.map((m) => m.texte)).toEqual(['Correction · Type — une idée'])
    expect(base.clotures).toEqual(['envoye'])
  })
})

describe('l’accès', () => {
  it.each([
    ['sans clé', { cle: null }, 'cle_absente'],
    ['avec un secret posté par erreur', { cle: 'fdy_sec_oups' }, 'cle_absente'],
    ['avec une clé inconnue', { cle: 'fdy_pub_inconnue' }, 'produit_inconnu'],
    ['depuis une autre origine', { origine: 'https://ailleurs.exemple.fr' }, 'origine_refusee'],
  ])('refuse %s', async (_cas, surcharge, motif) => {
    const base = baseAvec([{ role: 'collaborateur', texte: PAROLE }])

    const resultat = await jouerTour({ ...ACCES, ...surcharge }, portsAvec(base, modeleBouchon()))

    expect(resultat).toMatchObject({ ok: false, motif })
  })

  it('⛔ un identifiant deviné ne donne rien chez un autre produit', async () => {
    const base = baseAvec([{ role: 'collaborateur', texte: PAROLE }])

    const resultat = await jouerTour(
      { ...ACCES, retourId: 'retour-du-voisin' },
      portsAvec(base, modeleBouchon()),
    )

    expect(resultat).toMatchObject({ ok: false, motif: 'retour_inconnu' })
  })

  it('⛔ refuse au-delà du débit — un tour appelle le modèle, donc il coûte', async () => {
    const base = baseAvec([{ role: 'collaborateur', texte: PAROLE }])
    const ports = portsAvec(base, modeleBouchon())

    const resultat = await jouerTour(ACCES, { ...ports, debitParIp: { autoriser: () => false } })

    expect(resultat).toMatchObject({ ok: false, motif: 'debit_depasse' })
  })

  it('refuse un entretien déjà clos', async () => {
    const base = baseAvec([{ role: 'collaborateur', texte: PAROLE }], 'envoye')

    const resultat = await jouerTour(ACCES, portsAvec(base, modeleBouchon()))

    expect(resultat).toMatchObject({ ok: false, motif: 'entretien_clos' })
  })
})

describe('⛔ la sortie du modèle reste dans les bornes du contrat', () => {
  it('tronque plutôt que de perdre le tour — un caractère de trop n’est pas une panne', () => {
    const rendu = borner(
      {
        comprehension: {
          type: 'bug',
          titre: 'x'.repeat(500),
          resume: 'y'.repeat(4_000),
          ecran: 'z'.repeat(400),
        },
        question: 'q'.repeat(900),
        motif: 'm'.repeat(900),
      },
      2,
    )

    expect(SchemaTourRendu.safeParse(rendu).success).toBe(true)
  })

  it('ce que le bouchon rend passe le schéma du transport', async () => {
    const base = baseAvec([{ role: 'collaborateur', texte: PAROLE }])

    const resultat = await jouerTour(ACCES, portsAvec(base, modeleBouchon()))

    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(SchemaTourRendu.safeParse(resultat.tour).success).toBe(true)
  })

  it('⛔ ne laisse passer ni priorité, ni sévérité, ni score', () => {
    const rendu = borner(tourAvecQuestion('une question ?'), 2)

    expect(Object.keys(rendu.comprehension ?? {})).toEqual(
      expect.not.arrayContaining(['priorite', 'severite', 'score', 'impact']),
    )
    expect(SchemaTourRendu.safeParse(rendu).success).toBe(true)
  })
})
