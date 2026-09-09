/**
 * La production de la synthèse, exercée avec un bouchon — sans clé d’API, sans
 * base, hors ligne.
 *
 * ⛔ Ce que ce fichier existe pour prouver :
 *    1. **aucune synthèse ne contient de score**, de priorité ni de sévérité ;
 *    2. les citations rendues sont **verbatim**, quoi que le modèle produise ;
 *    3. un entretien pauvre donne `confiance: basse` et des `questions_ouvertes`.
 */
import { describe, expect, it, vi } from 'vitest'

import { modeleBouchon } from '../entretien/modele'
import { MAX_RELANCES } from '../entretien/tour'
import type { TourFil } from '../entretien/prompts'
import { messagesDuFil } from '../entretien/prompts'

import type { PortDepotSyntheses, PortsSynthese, RetourASynthetiser } from './produire'
import {
  etiquettesDe,
  finDe,
  fixerDepuisLesAxes,
  parolesDe,
  plafonnerConfiance,
  produireSynthese,
} from './produire'
import type { Synthese } from './schema'
import { SchemaSynthese } from './schema'

const RETOUR = 'ret_1'

/** ⚠️ Écrits à la main. ⛔ Jamais un vrai retour copié d’une base (CLAUDE.md §Secrets). */
const PAROLE =
  'alors euh le tri par date là sur la liste des dossiers dès que je reviens en arrière ' +
  'il se remet à zéro et faut que je le refasse à chaque fois c’est pénible'

const FIL: TourFil[] = [
  { role: 'collaborateur', texte: PAROLE },
  { role: 'bot', texte: 'C’est arrivé depuis un moment, ou c’est nouveau ?' },
  { role: 'collaborateur', texte: 'non ça a toujours fait ça je crois' },
]

/**
 * Le même fil, avec une correction de carte au bout.
 *
 * ⛔ « Liste des mandats » est un mot du BOT — la personne a corrigé un autre
 *    champ et laissé celui-là en place. La ligne est bien `collaborateur`, elle
 *    vient bien d’elle, et elle doit rester dans le fil ; mais elle ne peut pas
 *    devenir une citation (BUGS_LOG 016).
 */
const FIL_AVEC_CORRECTION: TourFil[] = [
  ...FIL,
  { role: 'collaborateur', texte: 'Correction · Écran — Liste des mandats', geste: 'correction' },
]

const BUG: Synthese = {
  type: 'bug',
  titre: 'Le tri par date de la liste des dossiers se réinitialise',
  resume: 'Le tri ne survit pas à la navigation. La personne le repose à chaque retour.',
  attendu: 'le tri reste en place au retour',
  constate: 'le tri revient à l’ordre par défaut',
  recurrence: 'systematique',
  zone: 'Liste des dossiers',
  impact: 'ralentit',
  citations: ['il se remet à zéro', 'c’est pénible'],
  confiance: 'moyenne',
  questions_ouvertes: ['Est-ce que ça touche aussi les autres listes ?'],
}

const IDEE: Synthese = {
  type: 'idee',
  titre: 'Pouvoir enregistrer un tri par défaut sur la liste des dossiers',
  resume: 'La personne voudrait que son tri soit retenu d’une session à l’autre.',
  besoin: 'ne pas reposer le même tri plusieurs fois par jour',
  frequence: 'plusieurs fois par jour',
  zone: 'Liste des dossiers',
  impact: 'agace',
  citations: ['faut que je le refasse à chaque fois'],
  confiance: 'moyenne',
  questions_ouvertes: [],
}

const QUESTION: Synthese = {
  type: 'question',
  titre: 'Sait-on si le tri est censé être retenu',
  resume: 'La personne se demande si le comportement observé est celui qui est prévu.',
  zone: 'Liste des dossiers',
  impact: 'indetermine',
  citations: ['c’est pénible'],
  confiance: 'basse',
  questions_ouvertes: ['La personne attend-elle une réponse, ou signale-t-elle ?'],
}

const GENE: Synthese = {
  type: 'gene',
  titre: 'Le retour en arrière fait reperdre le tri en cours',
  resume: 'Rien ne casse, mais la navigation coûte un geste de plus à chaque aller-retour.',
  zone: 'Liste des dossiers',
  impact: 'agace',
  citations: ['il se remet à zéro'],
  confiance: 'moyenne',
  questions_ouvertes: [],
}

interface Base {
  readonly depot: PortDepotSyntheses
  readonly ecrits: { synthese: unknown; etiquettes: unknown }[]
}

function baseAvec(retour: Partial<RetourASynthetiser> = {}, deja = false): Base {
  const ecrits: { synthese: unknown; etiquettes: unknown }[] = []

  const charge: RetourASynthetiser = {
    id: RETOUR,
    statut: 'envoye',
    contexte: { url: 'https://logiciel.exemple.fr/dossiers', ecran: 'Liste des dossiers' },
    fil: FIL,
    relancesPosees: 1,
    ...retour,
  }

  return {
    ecrits,
    depot: {
      charger: (id) => Promise.resolve(id === RETOUR ? charge : null),
      dejaFaite: () => Promise.resolve(deja),
      enregistrer: (_id, synthese, etiquettes) => {
        ecrits.push({ synthese, etiquettes })
        return Promise.resolve()
      },
    },
  }
}

function portsAvec(base: Base, modele: PortsSynthese['modele']): PortsSynthese {
  return { depot: base.depot, modele }
}

describe('les quatre types', () => {
  it.each([
    ['un bug', BUG],
    ['une idée', IDEE],
    ['une question', QUESTION],
    ['une gêne', GENE],
  ])('produit %s, et il passe le schéma', async (_cas, attendue) => {
    const resultat = await produireSynthese(
      RETOUR,
      portsAvec(baseAvec(), modeleBouchon({ synthese: attendue })),
      MAX_RELANCES,
    )

    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.synthese.contenu.type).toBe(attendue.type)
    expect(SchemaSynthese.safeParse(resultat.synthese.contenu).success).toBe(true)
  })

  it('les étiquettes recopiées sur le retour sont type, titre et zone — pas de la parole', () => {
    expect(etiquettesDe(BUG)).toEqual({
      type: 'bug',
      titre: 'Le tri par date de la liste des dossiers se réinitialise',
      zone: 'Liste des dossiers',
    })
  })
})

describe('⛔ ce que la synthèse ne contient pas', () => {
  it.each(['priorite', 'severite', 'score', 'note', 'cause_probable', 'retours_similaires'])(
    'refuse le champ « %s » — `.strict()` rend l’interdit vérifiable',
    (champ) => {
      const resultat = SchemaSynthese.safeParse({ ...BUG, [champ]: 'haute' })

      expect(resultat.success).toBe(false)
    },
  )

  it('⛔ aucune synthèse produite ne porte de score, quel qu’en soit le nom', async () => {
    const resultat = await produireSynthese(
      RETOUR,
      portsAvec(baseAvec(), modeleBouchon({ synthese: BUG })),
      MAX_RELANCES,
    )

    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return

    const cles = Object.keys(resultat.synthese.contenu)
    expect(cles).toEqual(
      expect.not.arrayContaining(['priorite', 'severite', 'score', 'note', 'urgence', 'gravite']),
    )
  })

  it('le prompt interdit explicitement les scores et les suggestions techniques', async () => {
    const { readFile } = await import('node:fs/promises')
    const gabarit = await readFile(
      new URL('./prompts/synthese.md', import.meta.url),
      'utf8',
    )

    expect(gabarit).toContain('Aucune priorité, aucune sévérité, aucun score')
    expect(gabarit).toContain('Aucune suggestion technique')
    expect(gabarit).toContain('Aucun rapprochement avec d’autres retours')
  })
})

describe('⛔ les citations sont verbatim, quoi que le modèle produise', () => {
  it('remplace la citation du modèle par la tranche exacte du fil', async () => {
    const reformulee: Synthese = {
      ...BUG,
      // Le modèle a mis une majuscule et doublé un espace.
      citations: ['Il se  remet à zéro'],
    }

    const resultat = await produireSynthese(
      RETOUR,
      portsAvec(baseAvec(), modeleBouchon({ synthese: reformulee })),
      MAX_RELANCES,
    )

    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.synthese.contenu.citations).toEqual(['il se remet à zéro'])
    // ⛔ LA PROPRIÉTÉ : sous-chaîne exacte du message d’origine.
    expect(PAROLE.includes(resultat.synthese.contenu.citations[0] as string)).toBe(true)
  })

  it('⛔ jette une citation inventée, et le signale — c’est le prompt qui dérive', async () => {
    const inventee: Synthese = {
      ...BUG,
      citations: ['il se remet à zéro', 'la fonctionnalité est défectueuse'],
    }
    const signaler = vi.fn()

    const resultat = await produireSynthese(
      RETOUR,
      { ...portsAvec(baseAvec(), modeleBouchon({ synthese: inventee })), signaler },
      MAX_RELANCES,
    )

    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.synthese.contenu.citations).toEqual(['il se remet à zéro'])
    expect(signaler).toHaveBeenCalledOnce()
  })

  it('⛔ ne cite JAMAIS le bot : les citations viennent de la personne, pas du fil entier', async () => {
    const duBot: Synthese = { ...BUG, citations: ['C’est arrivé depuis un moment'] }

    const resultat = await produireSynthese(
      RETOUR,
      portsAvec(baseAvec(), modeleBouchon({ synthese: duBot })),
      MAX_RELANCES,
    )

    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.synthese.contenu.citations).toEqual([])
  })

  it('ne prend que la parole de la personne comme source', () => {
    expect(parolesDe(FIL)).toEqual([PAROLE, 'non ça a toujours fait ça je crois'])
  })

  it('⛔ une correction de carte n’est pas de la parole — BUGS_LOG 016', () => {
    expect(parolesDe(FIL_AVEC_CORRECTION)).toEqual([PAROLE, 'non ça a toujours fait ça je crois'])
  })

  it('⛔ et le mot du bot passé par une correction ne peut donc plus être cité — 016', async () => {
    const parLaCorrection: Synthese = { ...BUG, citations: ['Liste des mandats'] }

    const resultat = await produireSynthese(
      RETOUR,
      portsAvec(
        baseAvec({ fil: FIL_AVEC_CORRECTION }),
        modeleBouchon({ synthese: parLaCorrection }),
      ),
      MAX_RELANCES,
    )

    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.synthese.contenu.citations).toEqual([])
  })

  it('⚠️ mais la correction reste dans le fil — on retire une SOURCE, pas une ligne', () => {
    expect(FIL_AVEC_CORRECTION.map((tour) => tour.texte)).toContain(
      'Correction · Écran — Liste des mandats',
    )
    expect(messagesDuFil(FIL_AVEC_CORRECTION)).toHaveLength(FIL_AVEC_CORRECTION.length)
  })
})

describe('⛔ ce qu’on a demandé et obtenu l’emporte sur ce que le modèle déduit', () => {
  /** Une réponse d’un clic, telle que `composerApports` l’écrit dans le fil. */
  const clic = (axe: string, valeur: string): TourFil => ({
    role: 'collaborateur',
    texte: `Réponse · ${axe} — ${valeur}`,
    geste: 'reponse_axe',
    axe,
    valeurAxe: valeur,
  })

  it('fixe `impact` sur la réponse d’un clic, pas sur la déduction', () => {
    // Le modèle a écrit `ralentit` ; la personne a cliqué « ça me bloque ».
    const fixee = fixerDepuisLesAxes(BUG, [...FIL, clic('ampleur', 'bloque')])

    expect(BUG.impact).toBe('ralentit')
    expect(fixee.impact).toBe('bloque')
  })

  it('fixe `recurrence` de la même façon', () => {
    const fixee = fixerDepuisLesAxes({ ...BUG, recurrence: 'deja_vu' }, [
      ...FIL,
      clic('recurrence', 'premiere_fois'),
    ])

    expect(fixee.recurrence).toBe('premiere_fois')
  })

  it('⚠️ le DERNIER clic gagne — quelqu’un qui se ravise a changé d’avis', () => {
    const fixee = fixerDepuisLesAxes(BUG, [
      ...FIL,
      clic('ampleur', 'bloque'),
      clic('ampleur', 'ralentit'),
    ])

    expect(fixee.impact).toBe('ralentit')
  })

  it('⛔ ne touche à rien quand personne n’a cliqué — le modèle garde la main', () => {
    expect(fixerDepuisLesAxes(BUG, FIL)).toEqual(BUG)
  })

  it('⛔ `indetermine` reste possible : c’est l’aveu du modèle, pas une réponse', () => {
    const indetermine: Synthese = { ...BUG, impact: 'indetermine' }

    expect(fixerDepuisLesAxes(indetermine, FIL).impact).toBe('indetermine')
  })

  it('⛔ une valeur qui n’est pas du schéma est IGNORÉE, pas recopiée', () => {
    // ⚠️ Le cas qui compte : `valeur_axe` est une colonne `text`. Une valeur
    //    fautive recopiée telle quelle ferait échouer l’écriture de la note —
    //    APRÈS la clôture, dans un chemin dont l’échec est avalé. On perdrait la
    //    note en silence, ce qui est pire que de garder la déduction du modèle.
    const fixee = fixerDepuisLesAxes(BUG, [...FIL, clic('ampleur', 'catastrophique')])

    expect(fixee.impact).toBe('ralentit')
    expect(SchemaSynthese.safeParse(fixee).success).toBe(true)
  })

  it('⚠️ une ligne qui n’est pas un geste d’axe ne fixe rien, même si elle en a l’air', () => {
    const menteuse: TourFil = {
      role: 'collaborateur',
      texte: 'Réponse · Ampleur — ça bloque',
      geste: null,
      axe: 'ampleur',
      valeurAxe: 'bloque',
    }

    expect(fixerDepuisLesAxes(BUG, [...FIL, menteuse]).impact).toBe('ralentit')
  })

  it('⛔ et une réponse d’un clic n’est jamais citable — elle porte un geste', () => {
    expect(parolesDe([...FIL, clic('ampleur', 'bloque')])).toEqual([
      PAROLE,
      'non ça a toujours fait ça je crois',
    ])
  })
})

describe('la confiance', () => {
  it('⛔ un entretien pauvre donne `basse` ET des questions_ouvertes', async () => {
    const pauvre: Synthese = {
      type: 'gene',
      titre: 'Quelque chose ne va pas sur la liste des dossiers',
      resume: 'La personne signale une gêne sans préciser laquelle.',
      zone: 'Liste des dossiers',
      impact: 'indetermine',
      citations: ['c’est pénible'],
      confiance: 'basse',
      questions_ouvertes: [
        'Qu’est-ce qui se passe exactement ?',
        'Depuis quand — la personne n’a pas répondu',
      ],
    }

    const resultat = await produireSynthese(
      RETOUR,
      portsAvec(baseAvec(), modeleBouchon({ synthese: pauvre })),
      MAX_RELANCES,
    )

    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.synthese.contenu.confiance).toBe('basse')
    expect(resultat.synthese.contenu.questions_ouvertes.length).toBeGreaterThan(0)
    // ⚠️ Extraite en colonne, en plus du jsonb : on filtre dessus.
    expect(resultat.synthese.confiance).toBe('basse')
  })

  it('⛔ un abandon force `basse`, même si le modèle se dit sûr de lui', async () => {
    const sur: Synthese = { ...BUG, confiance: 'haute' }

    const resultat = await produireSynthese(
      RETOUR,
      portsAvec(baseAvec({ statut: 'abandonne' }), modeleBouchon({ synthese: sur })),
      MAX_RELANCES,
    )

    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.synthese.contenu.confiance).toBe('basse')
  })

  it('⛔ aucune citation retenue force `basse` : on ne prétend pas avoir bien compris', () => {
    expect(plafonnerConfiance('haute', 'envoi', 0)).toBe('basse')
    expect(plafonnerConfiance('haute', 'envoi', 1)).toBe('haute')
    expect(plafonnerConfiance('haute', 'abandon', 3)).toBe('basse')
  })

  it('⚠️ la limite atteinte, elle, est DITE au modèle et non imposée', () => {
    expect(finDe('envoye', 2, MAX_RELANCES)).toBe('limite')
    expect(finDe('envoye', 1, MAX_RELANCES)).toBe('envoi')
    expect(finDe('abandonne', 0, MAX_RELANCES)).toBe('abandon')
    // Le modèle reste libre de dire « moyenne » sur un entretien à deux relances.
    expect(plafonnerConfiance('moyenne', 'limite', 2)).toBe('moyenne')
  })

  it('dit au modèle comment l’entretien s’est terminé — il ne peut pas le lire dans le fil', async () => {
    const modele = modeleBouchon({ synthese: BUG })

    await produireSynthese(
      RETOUR,
      portsAvec(baseAvec({ statut: 'abandonne' }), modele),
      MAX_RELANCES,
    )

    expect(modele.recuesSynthese[0]?.fin).toBe('abandon')
  })
})

describe('ce qui compte, et ce qui coûte', () => {
  it('enregistre le modèle utilisé et le compte de jetons', async () => {
    const resultat = await produireSynthese(
      RETOUR,
      portsAvec(
        baseAvec(),
        modeleBouchon({ synthese: BUG, identifiant: 'claude-essai-1', jetonsEntree: 1_234, jetonsSortie: 321 }),
      ),
      MAX_RELANCES,
    )

    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.synthese.modele).toBe('claude-essai-1')
    expect(resultat.synthese.jetonsEntree).toBe(1_234)
    expect(resultat.synthese.jetonsSortie).toBe(321)
  })

  it('⚠️ un fournisseur muet sur sa consommation ne fait pas échouer la synthèse', async () => {
    const resultat = await produireSynthese(
      RETOUR,
      portsAvec(baseAvec(), modeleBouchon({ synthese: BUG, jetonsEntree: null, jetonsSortie: null })),
      MAX_RELANCES,
    )

    expect(resultat).toMatchObject({ ok: true, synthese: { jetonsEntree: null, jetonsSortie: null } })
  })
})

describe('ce qu’on refuse', () => {
  it.each([
    ['un retour inconnu', 'inexistant', {}, 'retour_inconnu'],
    ['une synthèse déjà faite', RETOUR, { deja: true }, 'deja_faite'],
  ])('refuse %s', async (_cas, id, options, motif) => {
    const base = baseAvec({}, (options as { deja?: boolean }).deja === true)

    const resultat = await produireSynthese(
      id,
      portsAvec(base, modeleBouchon({ synthese: BUG })),
      MAX_RELANCES,
    )

    expect(resultat).toEqual({ ok: false, motif })
  })

  it('⛔ refuse un fil sans parole — on ne synthétise pas du vide', async () => {
    const resultat = await produireSynthese(
      RETOUR,
      portsAvec(baseAvec({ fil: [{ role: 'collaborateur', texte: '  ' }] }), modeleBouchon()),
      MAX_RELANCES,
    )

    expect(resultat).toEqual({ ok: false, motif: 'rien_a_synthetiser' })
  })

  it('⛔ un modèle muet ne perd rien : la synthèse manque, le retour est intact', async () => {
    const base = baseAvec()
    const signaler = vi.fn()

    const resultat = await produireSynthese(
      RETOUR,
      { ...portsAvec(base, modeleBouchon({ echoueSynthese: true })), signaler },
      MAX_RELANCES,
    )

    expect(resultat).toEqual({ ok: false, motif: 'modele_indisponible' })
    expect(base.ecrits).toEqual([])
    expect(signaler).toHaveBeenCalledOnce()
  })
})
