/**
 * Les indices techniques, dans un vrai navigateur (P-028, [D-026]).
 *
 * ⛔ POURQUOI CE PARCOURS EXISTE, ET POURQUOI IL NE PEUT PAS ÊTRE UN TEST
 *    UNITAIRE. Le collecteur écoute la page de QUELQU’UN D’AUTRE : `window`,
 *    ses gestionnaires d’erreur, ses requêtes réseau. Une exception réellement
 *    non capturée, un `PerformanceObserver` qui voit réellement passer un 404,
 *    un shadow DOM fermé qui affiche réellement la case à cocher — rien de tout
 *    ça n’existe dans happy-dom. C’est la règle du dépôt :
 *    **le widget ne se recette pas chez lui** (CLAUDE.md).
 *
 * ⛔ ET C’EST LE SEUL ENDROIT QUI PROUVE L’INVARIANT QUI COMPTE. Les boutons de
 *    la page de démonstration lèvent des exceptions dont le message porte
 *    « M. Dupont », « verrouillé » et un numéro de dossier. Ce parcours vérifie
 *    que **rien de tout cela n’atteint l’écran ni le réseau** — ni dans le
 *    panneau, ni dans le corps de `POST /api/retours`. Un test unitaire vérifie
 *    la fonction ; celui-ci vérifie la chaîne.
 */
import { expect, test } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

import { CLE_DEMO_E2E, ORIGINE_DEMO } from '../../playwright.config'

const PAROLE = 'j’ai cliqué sur valider et il ne s’est rien passé'

/**
 * Ce qui ne doit JAMAIS sortir de la page de l’hôte.
 *
 * ⚠️ Ces trois chaînes sont dans le MESSAGE des exceptions que les boutons de
 *    démonstration lèvent, et dans le chemin de la requête qu’ils déclenchent.
 *    Elles sont fictives — ⛔ jamais un vrai retour ni une vraie donnée
 *    (CLAUDE.md §Secrets).
 */
const JAMAIS = ['Dupont', 'verrouillé', 'Lefèvre', '4417', 'Bernard', 'secret-a-ne-pas-joindre']

/** ⚠️ Le shadow DOM est FERMÉ : on l’ouvre à l’instrumentation, comme ailleurs. */
async function ouvrirLaRacine(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const vrai = Element.prototype.attachShadow
    Element.prototype.attachShadow = function (init: ShadowRootInit): ShadowRoot {
      return vrai.call(this, { ...init, mode: 'open' })
    }
  })
}

async function poserLeWidget(page: Page): Promise<void> {
  await page.goto(`${ORIGINE_DEMO}/?cle=${CLE_DEMO_E2E}`)
  await expect(page.locator('.lanceur')).toBeVisible()
}

/** Le corps de l’ingestion, tel qu’il part réellement sur le fil. */
function corpsDeLIngestion(page: Page): { dernier: () => string | null } {
  let corps: string | null = null

  page.on('request', (requete: Request) => {
    if (requete.method() === 'POST' && requete.url().endsWith('/api/retours')) {
      corps = requete.postData()
    }
  })

  return { dernier: () => corps }
}

test('⛔ le message d’une exception n’atteint ni l’écran ni le réseau', async ({ page }) => {
  await ouvrirLaRacine(page)
  const ingestion = corpsDeLIngestion(page)
  await poserLeWidget(page)

  // ⚠️ Une exception RÉELLEMENT non capturée, levée par la page de l’hôte, et
  //    dont le message porte un nom de personne et un numéro de dossier.
  await page.locator('#casser-js').click()
  await page.locator('#casser-promesse').click()

  // ⚠️ ET LE CHEMIN POUSSÉ, DANS LE MÊME PARCOURS. Il mériterait son propre
  //    test, mais chaque parcours qui envoie consomme le quota d’ingestion
  //    (20/min/IP) que TOUS les parcours partagent sur localhost : un test de
  //    plus ici faisait rendre 429 à un parcours voisin, pour une raison qui
  //    n’était pas la sienne. Deux chemins, un envoi.
  await page.locator('#pousser-indice').click()

  await page.locator('.lanceur').click()
  await expect(page.locator('.panneau')).toBeVisible()

  // ── Ce que la personne VOIT ────────────────────────────────────────────────
  // ⛔ Le relevé est montré, pas subi : c’est ce qui rend le défaut « actif »
  //    défendable (D-026).
  const bascule = page.locator('.indices__bascule')
  await expect(bascule).toContainText('indices techniques relevés')
  await expect(page.locator('.indices__bascule input')).toBeChecked()

  await page.locator('.indices__voir').click()
  const liste = page.locator('.indices__liste')
  await expect(liste).toContainText('TypeError')
  await expect(liste).toContainText('RangeError')

  // ⛔ L’INVARIANT, sur le panneau entier et pas sur la seule liste.
  const affiche = (await page.locator('.panneau').textContent()) ?? ''
  for (const interdit of JAMAIS) {
    expect(affiche, `« ${interdit} » ne doit jamais s’afficher`).not.toContain(interdit)
  }

  // ── Ce qui PART ────────────────────────────────────────────────────────────
  await page.locator('.champ').fill(PAROLE)
  await page.locator('.envoyer').click()
  await expect(page.locator('.avis')).not.toBeEmpty({ timeout: 20_000 })

  const corps = ingestion.dernier()
  expect(corps).not.toBeNull()

  // ⛔ L’INVARIANT, sur les octets réellement envoyés.
  for (const interdit of JAMAIS) {
    expect(corps ?? '', `« ${interdit} » ne doit jamais partir`).not.toContain(interdit)
  }

  const envoye = JSON.parse(corps ?? '{}') as {
    contexte?: { indices?: { genre: string; nom?: string; message?: string; ecartMs?: number }[] }
  }
  const indices = envoye.contexte?.indices ?? []

  expect(indices.length).toBeGreaterThan(0)
  expect(indices.map((i) => i.nom)).toContain('TypeError')

  // ⚠️ Le chemin qu’un hôte utilise vraiment : une error boundary React avale
  //    l’exception de rendu, qui ne remonte jamais à `window`. Sans ce chemin,
  //    l’écran blanc ne produirait aucun indice — et c’est le seul qui porte
  //    une référence de corrélation (D-026).
  expect(indices).toContainEqual(expect.objectContaining({ reference: 'demo-7f3a91c2' }))

  // ⛔ Aucun indice ne porte de champ `message` — le contrat n’en a pas, et un
  //    corps qui en porterait un serait refusé en 400.
  for (const indice of indices) {
    expect(indice.message).toBeUndefined()
    expect(indice.ecartMs).toBeGreaterThanOrEqual(0)
  }
})

test('⛔ une requête en erreur part sans son numéro de dossier ni sa requête', async ({ page }) => {
  await ouvrirLaRacine(page)
  const ingestion = corpsDeLIngestion(page)
  await poserLeWidget(page)

  // ⚠️ `/demo/api/dossiers/4417/valider?token=…` — le chemin porte un numéro de
  //    dossier, la requête un jeton. Ni l’un ni l’autre ne doit sortir.
  //
  await page.locator('#casser-http').click()

  // ⚠️ ON ATTEND L’ENTRÉE DE TIMING, PAS LA RÉPONSE HTTP, et la nuance est ce
  //    qui rend ce parcours déterministe. `PerformanceObserver` n’est pas
  //    notifié à l’arrivée des en-têtes : l’entrée est ajoutée quand la
  //    ressource est finie, et la notification suit. Attendre la réponse
  //    ouvrait la bulle trop tôt — mesuré : l’indice manquait, alors que le
  //    collecteur était correct.
  //
  // ⚠️ Conséquence réelle et assumée du produit : une requête qui échoue dans
  //    la milliseconde précédant l’ouverture peut ne pas être relevée. Personne
  //    n’ouvre une bulle aussi vite, et un tampon d’attente coûterait plus que
  //    ce qu’il rattraperait.
  await page.waitForFunction(() =>
    performance
      .getEntriesByType('resource')
      .some(
        (entree) =>
          entree.name.includes('/demo/api/dossiers/') &&
          (entree as PerformanceResourceTiming).responseStatus >= 400,
      ),
  )

  await page.locator('.lanceur').click()
  await page.locator('.champ').fill(PAROLE)
  await page.locator('.envoyer').click()
  await expect(page.locator('.avis')).not.toBeEmpty({ timeout: 20_000 })

  const corps = ingestion.dernier() ?? ''
  const indices =
    (JSON.parse(corps || '{}') as { contexte?: { indices?: { genre: string; chemin?: string }[] } })
      .contexte?.indices ?? []

  const http = indices.find((indice) => indice.genre === 'http')
  expect(http, 'la requête en erreur doit être relevée').toBeDefined()

  // ⛔ LE CŒUR DE LA NORMALISATION : l’adresse, jamais son argument.
  expect(http?.chemin).toBe('/demo/api/dossiers/:id/valider')
  expect(corps).not.toContain('4417')
  expect(corps).not.toContain('token')
  expect(corps).not.toContain('secret-a-ne-pas-joindre')
})

test('⛔ décoché, le champ disparaît ENTIÈREMENT du corps', async ({ page }) => {
  await ouvrirLaRacine(page)
  const ingestion = corpsDeLIngestion(page)
  await poserLeWidget(page)

  await page.locator('#casser-js').click()
  await page.locator('.lanceur').click()

  await expect(page.locator('.indices__bascule input')).toBeChecked()
  await page.locator('.indices__bascule input').uncheck()

  await page.locator('.champ').fill(PAROLE)
  await page.locator('.envoyer').click()
  await expect(page.locator('.avis')).not.toBeEmpty({ timeout: 20_000 })

  const envoye = JSON.parse(ingestion.dernier() ?? '{}') as {
    contexte?: Record<string, unknown>
  }

  // ⛔ RETIRÉ, PAS VIDE. Un `indices: []` se lirait comme « le navigateur n’a
  //    rien relevé », alors que la vérité est « quelqu’un a refusé de le
  //    joindre ». Les deux ne se confondent pas, et la seconde ne nous regarde
  //    pas (D-026).
  expect(Object.keys(envoye.contexte ?? {})).not.toContain('indices')
})

test('⛔ le widget n’installe rien chez son hôte — ni onerror, ni fetch enveloppé', async ({
  page,
}) => {
  // ⚠️ Relevé AVANT le chargement du widget, puis comparé après : c’est la
  //    seule façon de prouver que rien n’a été remplacé.
  await page.addInitScript(() => {
    ;(window as unknown as { __avant: Record<string, unknown> }).__avant = {
      fetch: window.fetch,
      xhr: window.XMLHttpRequest,
      onerror: window.onerror,
    }
  })

  // ⛔ ON N’OUVRE PAS LA RACINE FANTÔME ICI, et c’est le seul test du fichier
  //    dans ce cas : ce parcours ne regarde que les globales de l’hôte. On
  //    attend donc le montage par `window.feedys.version`, pas par un sélecteur
  //    qui n’existerait qu’avec un shadow DOM ouvert.
  await page.goto(`${ORIGINE_DEMO}/?cle=${CLE_DEMO_E2E}`)
  await page.waitForFunction(() => (window as { feedys?: { version?: string } }).feedys?.version !== undefined)

  const intact = await page.evaluate(() => {
    const avant = (window as unknown as { __avant: Record<string, unknown> }).__avant
    return {
      fetch: window.fetch === avant['fetch'],
      xhr: window.XMLHttpRequest === avant['xhr'],
      onerror: window.onerror === avant['onerror'],
    }
  })

  // ⛔ Envelopper le `fetch` de son hôte quand on est un invité, c’est entrer
  //    dans sa chaîne de wrappers — Sentry, Datadog et Apollo en posent déjà —,
  //    fausser ses traces et devenir le suspect n°1 de son prochain bug.
  expect(intact.fetch, 'fetch a été remplacé').toBe(true)
  expect(intact.xhr, 'XMLHttpRequest a été remplacé').toBe(true)
  // ⛔ Et `window.onerror = …` écraserait le gestionnaire que l’hôte a peut-être
  //    déjà posé, sans un mot.
  expect(intact.onerror, 'window.onerror a été écrasé').toBe(true)
})
