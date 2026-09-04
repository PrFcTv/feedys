/**
 * L’ingestion, sans base et sans réseau.
 *
 * ⛔ Le premier bloc est LE test du projet : il prouve que la parole est en base
 *    avant que quoi que ce soit d’extérieur ne soit appelé. Il rougit si on
 *    déplace la persistance après l’aval, et il rougit si on laisse une
 *    défaillance d’aval remonter jusqu’au collaborateur.
 */
import { describe, expect, it } from 'vitest'

import type {
  PortDepotRetours,
  PortsIngestion,
  ProduitConnu,
  RetourAEnregistrer,
} from './ingestion'
import { signerIdentite } from '../identite/jeton'

import { ingerer } from './ingestion'

/** ⛔ Inventé. Le dépôt est public : aucun secret réel, jamais. */
const SECRET = 'fdy_sec_secret-de-test-invente-de-toutes-pieces'

const PRODUIT: ProduitConnu = {
  id: 'prod_essai',
  domaine: 'victoria.exemple.fr',
  actif: true,
  secret: SECRET,
}

const CLE = 'fdy_pub_essai'

function corps(supplement: Record<string, unknown> = {}): string {
  return JSON.stringify({
    texte: 'le tri de la colonne date remet tout à zéro quand je reviens sur la page',
    contexte: { url: 'https://victoria.exemple.fr/dossiers' },
    ...supplement,
  })
}

interface Bancs {
  ports: PortsIngestion
  journal: string[]
  ecrits: RetourAEnregistrer[]
}

/** Un banc d’essai : tout passe, tout est enregistré, rien n’est aléatoire. */
function banc(options: Partial<PortsIngestion> & { produit?: ProduitConnu | null } = {}): Bancs {
  const journal: string[] = []
  const ecrits: RetourAEnregistrer[] = []

  const depot: PortDepotRetours = {
    async produitParCle() {
      journal.push('produitParCle')
      return options.produit === undefined ? PRODUIT : options.produit
    },
    async enregistrer(retour) {
      journal.push('enregistrer')
      ecrits.push(retour)
      return 'ret_1'
    },
  }

  const ports: PortsIngestion = {
    depot,
    stockage: {
      async ecrire(genre) {
        journal.push(`stockage:${genre}`)
        return `${genre}/2026/09/xyz.bin`
      },
    },
    debitParCle: { autoriser: () => true },
    debitParIp: { autoriser: () => true },
    maintenant: () => 1_757_000_000_000,
    ...options,
  }

  return { ports, journal, ecrits }
}

function entree(supplement: Partial<Parameters<typeof ingerer>[0]> = {}) {
  const corpsBrut = supplement.corpsBrut ?? corps()
  return {
    cle: CLE,
    identite: null,
    origine: 'https://victoria.exemple.fr',
    ip: '203.0.113.7',
    octets: Buffer.byteLength(corpsBrut, 'utf8'),
    corpsBrut,
    ...supplement,
  }
}

describe('⛔ l’invariant — la parole est en base avant tout appel en aval', () => {
  it('enregistre AVANT d’appeler l’aval', async () => {
    const { ports, journal } = banc({ aval: async () => void journal.push('aval') })

    const resultat = await ingerer(entree(), ports)

    expect(resultat).toEqual({ ok: true, retour: 'ret_1' })
    expect(journal.indexOf('enregistrer')).toBeLessThan(journal.indexOf('aval'))
  })

  it('rend quand même 201 quand l’aval échoue — la parole, elle, est sauvée', async () => {
    const { ports, journal } = banc({
      aval: async () => {
        throw new Error('le modèle est tombé')
      },
    })

    const resultat = await ingerer(entree(), ports)

    expect(resultat).toEqual({ ok: true, retour: 'ret_1' })
    expect(journal).toContain('enregistrer')
  })

  it('signale l’échec d’aval sans jamais recopier le corps du retour', async () => {
    const signales: string[] = []
    const { ports } = banc({
      aval: async () => {
        throw new Error('le modèle est tombé')
      },
      signaler: (quoi) => void signales.push(quoi),
    })

    await ingerer(entree(), ports)

    expect(signales).toEqual(['traitement en aval du retour'])
    expect(signales.join(' ')).not.toContain('colonne date')
  })
})

describe('les refus', () => {
  it('refuse un corps trop gros — et sans toucher à la base', async () => {
    const { ports, journal } = banc()

    const resultat = await ingerer(entree({ octets: 8 * 1024 * 1024 }), ports)

    expect(resultat).toMatchObject({ ok: false, motif: 'corps_trop_gros' })
    expect(journal).toEqual([])
  })

  it('refuse une clé absente', async () => {
    const { ports } = banc()
    expect(await ingerer(entree({ cle: null }), ports)).toMatchObject({ motif: 'cle_absente' })
  })

  it('refuse ce qui n’est pas une clé publique — un secret posté par erreur, par exemple', async () => {
    const { ports, journal } = banc()

    const resultat = await ingerer(entree({ cle: 'fdy_sec_oups' }), ports)

    expect(resultat).toMatchObject({ motif: 'cle_absente' })
    expect(journal).toEqual([])
  })

  it('refuse au-delà du débit, AVANT d’interroger la base', async () => {
    const { ports, journal } = banc({ debitParCle: { autoriser: () => false } })

    const resultat = await ingerer(entree(), ports)

    expect(resultat).toMatchObject({ motif: 'debit_depasse' })
    expect(journal).toEqual([])
  })

  it('compte aussi par IP', async () => {
    const { ports } = banc({ debitParIp: { autoriser: () => false } })
    expect(await ingerer(entree(), ports)).toMatchObject({ motif: 'debit_depasse' })
  })

  it('refuse du JSON invalide', async () => {
    const { ports } = banc()
    expect(await ingerer(entree({ corpsBrut: '{' }), ports)).toMatchObject({
      motif: 'corps_invalide',
    })
  })

  it('refuse un retour sans texte ni audio', async () => {
    const { ports } = banc()
    const vide = JSON.stringify({ contexte: { url: 'https://victoria.exemple.fr/' } })

    expect(await ingerer(entree({ corpsBrut: vide }), ports)).toMatchObject({
      motif: 'corps_invalide',
    })
  })

  it('refuse une clé inconnue', async () => {
    const { ports } = banc({ produit: null })
    expect(await ingerer(entree(), ports)).toMatchObject({ motif: 'produit_inconnu' })
  })

  it('refuse un produit inactif — du même motif, pour ne rien dire de plus', async () => {
    const { ports } = banc({ produit: { ...PRODUIT, actif: false } })

    const resultat = await ingerer(entree(), ports)

    expect(resultat).toMatchObject({ ok: false, motif: 'produit_inconnu', message: 'Produit inconnu.' })
  })

  it('refuse une origine étrangère au produit', async () => {
    const { ports } = banc()
    expect(await ingerer(entree({ origine: 'https://mechant.exemple.fr' }), ports)).toMatchObject({
      motif: 'origine_refusee',
    })
  })
})

describe('ce qui est écrit', () => {
  it('range le contexte champ par champ, sans rien inventer', async () => {
    const { ports, ecrits } = banc()
    const corpsBrut = JSON.stringify({
      texte: 'le tri se remet à zéro',
      transcriptBrut: 'euh le tri se remet à zéro',
      contexte: {
        url: 'https://victoria.exemple.fr/dossiers?tri=date',
        titrePage: 'Dossiers',
        ecran: 'dossiers',
        selecteurDom: 'table.dossiers th:nth-child(3)',
        navigateur: 'Chrome 141',
        systeme: 'Windows 11',
        viewportL: 1920,
        viewportH: 1080,
        fuseau: 'Europe/Paris',
        agentBrut: { langue: 'fr-FR' },
      },
    })

    await ingerer(entree({ corpsBrut }), ports)

    expect(ecrits[0]).toEqual({
      produitId: 'prod_essai',
      source: 'texte',
      auteur: { ref: null, nom: null, role: null, verifiee: false },
      message: {
        texte: 'le tri se remet à zéro',
        transcriptBrut: 'euh le tri se remet à zéro',
        audioChemin: null,
      },
      contexte: {
        url: 'https://victoria.exemple.fr/dossiers?tri=date',
        titrePage: 'Dossiers',
        ecran: 'dossiers',
        selecteurDom: 'table.dossiers th:nth-child(3)',
        navigateur: 'Chrome 141',
        systeme: 'Windows 11',
        viewportL: 1920,
        viewportH: 1080,
        captureChemin: null,
        fuseau: 'Europe/Paris',
        agentBrut: { langue: 'fr-FR' },
      },
    })
  })

  it('déclare « voix » dès qu’il y a de l’audio, quoi que le widget prétende', async () => {
    const { ports, ecrits } = banc()
    const corpsBrut = corps({
      texte: undefined,
      source: 'texte',
      audio: { type: 'audio/webm', donnees: 'AAAA' },
    })

    await ingerer(entree({ corpsBrut }), ports)

    expect(ecrits[0]?.source).toBe('voix')
    expect(ecrits[0]?.message.audioChemin).toBe('audio/2026/09/xyz.bin')
  })

  it('accepte un transcript SANS audio et le déclare « voix » — Web Speech ne rend pas de fichier', async () => {
    const { ports, ecrits } = banc()

    await ingerer(entree({ corpsBrut: corps({ source: 'voix' }) }), ports)

    expect(ecrits[0]?.source).toBe('voix')
    expect(ecrits[0]?.message.audioChemin).toBeNull()
  })

  it('laisse le texte vide quand seul l’audio est arrivé — la transcription remplira la ligne', async () => {
    const { ports, ecrits } = banc()
    const corpsBrut = JSON.stringify({
      audio: { type: 'audio/ogg', donnees: 'AAAA' },
      contexte: { url: 'https://victoria.exemple.fr/' },
    })

    await ingerer(entree({ corpsBrut }), ports)

    expect(ecrits[0]?.message.texte).toBe('')
  })
})

describe('le stockage', () => {
  it('perd la capture sans perdre le retour — échec doux', async () => {
    const signales: string[] = []
    const { ports, ecrits } = banc({
      stockage: {
        async ecrire() {
          throw new Error('disque plein')
        },
      },
      signaler: (quoi) => void signales.push(quoi),
    })

    const corpsBrut = JSON.stringify({
      texte: 'le tri se remet à zéro',
      contexte: {
        url: 'https://victoria.exemple.fr/',
        capture: { type: 'image/webp', donnees: 'AAAA' },
      },
    })

    const resultat = await ingerer(entree({ corpsBrut }), ports)

    expect(resultat).toMatchObject({ ok: true })
    expect(ecrits[0]?.contexte.captureChemin).toBeNull()
    expect(signales).toEqual(['stockage de la capture'])
  })

  it('refuse bruyamment quand l’audio ne peut pas être rangé — l’audio EST la parole', async () => {
    const { ports, journal } = banc({
      stockage: {
        async ecrire() {
          throw new Error('disque plein')
        },
      },
    })

    const corpsBrut = JSON.stringify({
      audio: { type: 'audio/webm', donnees: 'AAAA' },
      contexte: { url: 'https://victoria.exemple.fr/' },
    })

    const resultat = await ingerer(entree({ corpsBrut }), ports)

    expect(resultat).toMatchObject({ ok: false, motif: 'stockage_indisponible' })
    expect(journal).not.toContain('enregistrer')
  })
})

describe('⛔ l’identité ne refuse jamais rien (P-012)', () => {
  const MAINTENANT = 1_757_000_000_000
  const DANS_UNE_HEURE = Math.floor(MAINTENANT / 1_000) + 3_600

  const CHARGE = { ref: 'u-4218', nom: 'Camille Dupont', role: 'gestionnaire', exp: DANS_UNE_HEURE }

  it('attache l’auteur d’un jeton valide', async () => {
    const { ports, ecrits } = banc()

    const resultat = await ingerer(
      entree({ identite: signerIdentite(CHARGE, SECRET) }),
      ports,
    )

    expect(resultat).toMatchObject({ ok: true })
    expect(ecrits[0]?.auteur).toEqual({
      ref: 'u-4218',
      nom: 'Camille Dupont',
      role: 'gestionnaire',
      verifiee: true,
    })
  })

  it('accepte le retour SANS jeton, en auteur inconnu', async () => {
    const { ports, ecrits } = banc()

    const resultat = await ingerer(entree(), ports)

    expect(resultat).toMatchObject({ ok: true })
    expect(ecrits[0]?.auteur).toEqual({ ref: null, nom: null, role: null, verifiee: false })
  })

  it.each([
    ['forgé', signerIdentite(CHARGE, 'fdy_sec_un-autre-secret-invente')],
    ['expiré', signerIdentite({ ...CHARGE, exp: Math.floor(MAINTENANT / 1_000) - 1 }, SECRET)],
    ['illisible', 'ceci-nest-pas-un-jeton'],
  ])('⛔ ACCEPTE le retour avec un jeton %s — un 201, pas un refus', async (_cas, jeton) => {
    const { ports, ecrits } = banc()

    const resultat = await ingerer(entree({ identite: jeton }), ports)

    expect(resultat).toMatchObject({ ok: true })
    expect(ecrits[0]?.auteur).toEqual({ ref: null, nom: null, role: null, verifiee: false })
  })

  it('accepte le retour quand le produit n’a pas de secret utilisable', async () => {
    const { ports, ecrits } = banc({ produit: { ...PRODUIT, secret: null } })

    const resultat = await ingerer(entree({ identite: signerIdentite(CHARGE, SECRET) }), ports)

    expect(resultat).toMatchObject({ ok: true })
    expect(ecrits[0]?.auteur.verifiee).toBe(false)
  })

  it('signale une identité écartée, sans rien dire du corps du retour', async () => {
    const signales: string[] = []
    const { ports } = banc({ signaler: (quoi) => void signales.push(quoi) })

    await ingerer(entree({ identite: signerIdentite(CHARGE, 'fdy_sec_autre') }), ports)

    expect(signales).toEqual(['identité non retenue — signature_invalide'])
  })

  it('ne signale RIEN quand il n’y a pas de jeton — c’est le cas ordinaire', async () => {
    const signales: string[] = []
    const { ports } = banc({ signaler: (quoi) => void signales.push(quoi) })

    await ingerer(entree(), ports)

    expect(signales).toEqual([])
  })
})
