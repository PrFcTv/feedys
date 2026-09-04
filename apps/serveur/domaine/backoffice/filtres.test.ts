import { describe, expect, it } from 'vitest'

import {
  AUCUN_FILTRE,
  auMoinsUnFiltre,
  depuisDe,
  lireFiltres,
  requeteDe,
} from './filtres'

describe('la lecture des filtres', () => {
  it('lit ce qu’elle reconnaît', () => {
    expect(lireFiltres({ statut: 'lu', type: 'bug', zone: 'Liste', periode: '7j' })).toEqual({
      statut: 'lu',
      type: 'bug',
      zone: 'Liste',
      periode: '7j',
    })
  })

  it('⚠️ ignore ce qu’elle ne reconnaît pas, sans refuser — une liste est une lecture', () => {
    expect(lireFiltres({ statut: 'inconnu', type: '', periode: 'siecle' })).toEqual(AUCUN_FILTRE)
  })

  it('⛔ une valeur hors liste n’atteint jamais le SQL', () => {
    expect(lireFiltres({ statut: "lu'; drop table retours; --" }).statut).toBeNull()
    expect(lireFiltres({ type: '1 or 1=1' }).type).toBeNull()
  })

  it('prend la première valeur d’un paramètre répété', () => {
    expect(lireFiltres({ statut: ['traite', 'lu'] }).statut).toBe('traite')
  })

  it('borne la zone, qui est saisie à la main', () => {
    expect(lireFiltres({ zone: 'z'.repeat(500) }).zone).toHaveLength(200)
    expect(lireFiltres({ zone: '   ' }).zone).toBeNull()
  })
})

describe('la période', () => {
  const MAINTENANT = Date.parse('2026-09-04T12:00:00.000Z')

  it('rend null pour « depuis toujours »', () => {
    expect(depuisDe('tout', MAINTENANT)).toBeNull()
  })

  it('rend une borne basse', () => {
    expect(depuisDe('24h', MAINTENANT)?.toISOString()).toBe('2026-09-03T12:00:00.000Z')
    expect(depuisDe('7j', MAINTENANT)?.toISOString()).toBe('2026-08-28T12:00:00.000Z')
  })
})

describe('la requête d’URL', () => {
  it('⚠️ n’écrit pas les filtres vides — une URL de liste doit se recopier', () => {
    expect(requeteDe(AUCUN_FILTRE)).toBe('')
  })

  it('écrit ce qui est posé', () => {
    expect(requeteDe({ statut: 'lu', type: null, zone: 'Liste des dossiers', periode: '7j' })).toBe(
      '?statut=lu&zone=Liste+des+dossiers&periode=7j',
    )
  })
})

describe('auMoinsUnFiltre', () => {
  it('distingue « rien ne correspond » de « il n’y a rien »', () => {
    expect(auMoinsUnFiltre(AUCUN_FILTRE)).toBe(false)
    expect(auMoinsUnFiltre({ ...AUCUN_FILTRE, periode: '24h' })).toBe(true)
    expect(auMoinsUnFiltre({ ...AUCUN_FILTRE, zone: 'Liste' })).toBe(true)
  })
})
