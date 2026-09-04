import { describe, expect, it } from 'vitest'

import {
  BUDGET_WIDGET_OCTETS,
  VARIABLES_OBLIGATOIRES,
  enKo,
  messageVariablesManquantes,
  messageWidget,
  variablesManquantes,
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
