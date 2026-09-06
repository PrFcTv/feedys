import { describe, expect, it } from 'vitest'

import {
  BUDGET_WIDGET_OCTETS,
  VARIABLES_OBLIGATOIRES,
  enKo,
  indiceDeRole,
  messageVariablesManquantes,
  messageWidget,
  variablesManquantes,
  messageRole,
  verdictRole,
  verdictWidget,
} from './controles'

/** ⛔ Inventé de bout en bout. Aucune valeur réelle dans un dépôt public. */
const COMPLET: Record<string, string> = {
  DATABASE_URL: 'postgresql://feedys:feedys@base:5432/feedys',
  FEEDYS_URL_PUBLIQUE: 'https://feedys.exemple.fr',
  ANTHROPIC_API_KEY: 'cle-de-test',
  FEEDYS_MODELE: 'claude-sonnet-5',
  FEEDYS_BO_MOT_DE_PASSE: 'mot-de-passe-de-test',
  FEEDYS_CLE_CHIFFREMENT: 'clef-de-test',
  FEEDYS_STOCKAGE: '/stockage',
  FEEDYS_PROMPTS: '/app/prompts',
  FEEDYS_ACTIFS: '/app/actifs',
  SMTP_URL: 'smtp://relais.exemple.fr',
  FEEDYS_EMAIL_DE: 'feedys@exemple.fr',
  FEEDYS_EMAIL_A: 'dev@exemple.fr',
  FEEDYS_MCP_JETON: 'jeton-de-test',
  FEEDYS_VERSION: '1.0.0',
  DATABASE_URL_MIGRATIONS: 'postgresql://feedys_proprietaire:mot-de-passe-invente@base:5432/feedys',
}

describe('variablesManquantes', () => {
  it('ne trouve rien à redire à un environnement complet', () => {
    expect(variablesManquantes(COMPLET)).toEqual({ obligatoires: [], recommandees: [] })
  })

  it.each(VARIABLES_OBLIGATOIRES)('⛔ signale %s absente', (nom) => {
    const { [nom]: _absente, ...sansElle } = COMPLET

    expect(variablesManquantes(sansElle).obligatoires).toEqual([nom])
  })

  it('⚠️ traite une variable VIDE comme absente — c’est le cas courant', () => {
    expect(variablesManquantes({ ...COMPLET, DATABASE_URL: '   ' }).obligatoires).toEqual([
      'DATABASE_URL',
    ])
  })

  it('range SMTP et le jeton MCP en recommandées — leur absence dégrade, elle ne casse pas', () => {
    const { SMTP_URL: _s, FEEDYS_MCP_JETON: _j, ...sansConfort } = COMPLET
    const verdict = variablesManquantes(sansConfort)

    expect(verdict.obligatoires).toEqual([])
    expect(verdict.recommandees.map((m) => m.nom)).toEqual(['SMTP_URL', 'FEEDYS_MCP_JETON'])
    expect(verdict.recommandees[0]?.consequence).toContain('email')
  })
})

describe('verdictWidget', () => {
  it('accepte un widget sous le budget', () => {
    expect(verdictWidget(30_000)).toEqual({ ok: true, octets: 30_000 })
  })

  it('accepte le budget pile — la borne est inclusive', () => {
    expect(verdictWidget(BUDGET_WIDGET_OCTETS)).toEqual({ ok: true, octets: BUDGET_WIDGET_OCTETS })
  })

  it('⛔ refuse un octet de trop — un dépassement se décide, il ne se glisse pas', () => {
    expect(verdictWidget(BUDGET_WIDGET_OCTETS + 1)).toEqual({
      ok: false,
      motif: 'hors_budget',
      octets: BUDGET_WIDGET_OCTETS + 1,
    })
  })

  it('⛔ refuse un widget absent', () => {
    expect(verdictWidget(undefined)).toEqual({ ok: false, motif: 'absent' })
  })
})

describe('les messages', () => {
  it('⛔ nomme les variables sans jamais montrer une valeur', () => {
    const message = messageVariablesManquantes(['DATABASE_URL', 'ANTHROPIC_API_KEY'])

    expect(message).toContain('DATABASE_URL')
    expect(message).toContain('ANTHROPIC_API_KEY')
    expect(message).not.toContain(COMPLET['DATABASE_URL'] as string)
    expect(message).not.toContain(COMPLET['ANTHROPIC_API_KEY'] as string)
  })

  it('dit le poids et le budget quand le widget déborde', () => {
    const message = messageWidget(verdictWidget(70 * 1024))

    expect(message).toContain('70.0 Ko')
    expect(message).toContain('60.0 Ko')
  })

  it('dit ce qui se passerait chez les hôtes quand le widget est absent', () => {
    expect(messageWidget(verdictWidget(undefined))).toContain('FEEDYS_ACTIFS')
  })

  it('ne dit rien quand tout va bien', () => {
    expect(messageWidget(verdictWidget(1_000))).toBeUndefined()
  })
})

describe('enKo', () => {
  it.each([
    [0, '0.0 Ko'],
    [1024, '1.0 Ko'],
    [61_440, '60.0 Ko'],
  ])('rend %i octets comme « %s »', (octets, attendu) => {
    expect(enKo(octets)).toBe(attendu)
  })
})

describe('verdictRole — le garde-fou de D-009 mord-il vraiment ?', () => {
  const SEPARE = {
    role: 'feedys_service',
    superutilisateur: false,
    heriteDuGroupe: true,
    tablesPossedees: 0,
    tables: 8,
  }

  it('dit séparé quand le rôle ne possède rien et hérite du groupe', () => {
    expect(verdictRole(SEPARE)).toEqual({ separe: true, role: 'feedys_service', tables: 8 })
  })

  it('⛔ un superutilisateur n’est PAS séparé — il contourne tout', () => {
    const verdict = verdictRole({ ...SEPARE, superutilisateur: true })

    expect(verdict.separe).toBe(false)
    expect(verdict).toMatchObject({ motif: 'superutilisateur' })
  })

  it('⛔ un propriétaire de table n’est PAS séparé', () => {
    const verdict = verdictRole({ ...SEPARE, tablesPossedees: 8 })

    expect(verdict).toMatchObject({ separe: false, motif: 'proprietaire' })
  })

  it('⚠️ une SEULE table possédée suffit à dire non', () => {
    expect(verdictRole({ ...SEPARE, tablesPossedees: 1 })).toMatchObject({ separe: false })
  })

  it('⚠️ un superutilisateur est annoncé comme tel, pas comme propriétaire', () => {
    // Il est les deux ; le motif doit nommer ce qu’il faut corriger.
    const verdict = verdictRole({ ...SEPARE, superutilisateur: true, tablesPossedees: 8 })

    expect(verdict).toMatchObject({ motif: 'superutilisateur' })
  })

  it('signale un rôle qui ne possède rien mais n’hérite pas du groupe', () => {
    expect(verdictRole({ ...SEPARE, heriteDuGroupe: false })).toMatchObject({
      separe: false,
      motif: 'sans_heritage',
    })
  })

  /**
   * ⛔ LE CAS QUI PASSAIT POUR UNE RÉUSSITE. Les rôles sont cluster-wide :
   *    `feedys_app` existe dans TOUTES les bases du cluster, et l’héritage y
   *    répond « oui » partout. Une `DATABASE_URL` qui désigne une base vide — ou
   *    la mauvaise base du même cluster, le copier-coller le plus banal — donnait
   *    « propriétaire d’aucune des 0 tables. Les GRANT s’appliquent. »
   *
   * ⚠️ Combiné au fait que l’échec de connexion était avalé, l’exploitant lisait
   *    une ligne rassurante sur une configuration morte.
   */
  it('⛔ zéro table n’est PAS une séparation réussie — c’est une base vide', () => {
    expect(verdictRole({ ...SEPARE, tables: 0 })).toMatchObject({
      separe: false,
      motif: 'base_vide',
    })
  })

  it('⚠️ et le message de base vide n’accuse pas les GRANT — on ne les a pas vus', () => {
    const message = messageRole({ separe: false, role: 'feedys_service', motif: 'base_vide' })

    expect(message).toContain('AUCUNE table')
    expect(message).toContain('DATABASE_URL')
    expect(message).not.toContain('Les GRANT ne mordent pas')
  })
})

describe('messageRole', () => {
  it('nomme le rôle — c’est justement ce qu’on a besoin de lire', () => {
    const message = messageRole({ separe: true, role: 'feedys_service', tables: 8 })

    expect(message).toContain('feedys_service')
    expect(message).toContain('8 tables')
  })

  it('⛔ ne contient JAMAIS d’URL — elle porte un mot de passe', () => {
    for (const motif of ['superutilisateur', 'proprietaire', 'sans_heritage'] as const) {
      const message = messageRole({ separe: false, role: 'feedys', motif })

      expect(message).not.toContain('postgresql://')
      expect(message).not.toContain('DATABASE_URL')
      expect(message).toContain('hebergement.md')
    }

    // ⚠️ `base_vide` nomme DATABASE_URL — c’est la variable à corriger — mais
    //    toujours pas sa valeur.
    expect(messageRole({ separe: false, role: 'feedys', motif: 'base_vide' })).not.toContain(
      'postgresql://',
    )
  })
})

/**
 * ⛔ L’INDICE QUI MANQUAIT À TROIS HEURES DU MATIN.
 *
 * ⚠️ Il vit dans le module PUR, et pas dans `infra/demarrage.ts` où il était :
 *    `pnpm db:migrate` en a autant besoin que le démarrage, et un outil ne doit
 *    pas importer l’infrastructure du serveur pour obtenir une phrase.
 */
describe('indiceDeRole', () => {
  it('explique « permission denied » par le rôle, et nomme la variable', () => {
    const indice = indiceDeRole(new Error('permission denied for schema public'))

    expect(indice).toContain('DATABASE_URL_MIGRATIONS')
    expect(indice).toContain('hebergement.md')
  })

  it('⛔ se tait sur toute autre erreur — un indice qui parle toujours ne dit rien', () => {
    expect(indiceDeRole(new Error('connection refused'))).toBe('')
    expect(indiceDeRole('la base et le dépôt ont divergé')).toBe('')
  })

  it('accepte ce qui n’est pas une Error — un rejet peut être n’importe quoi', () => {
    expect(indiceDeRole('permission denied for schema public')).toContain('propriétaire')
  })
})
