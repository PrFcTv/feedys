/**
 * Le widget rendu dans la page de quelqu’un d’autre — et ce qu’il dit quand le
 * tour d’entretien n’aboutit pas.
 *
 * ⚠️ POURQUOI CE PARCOURS EXISTE. Les autres parcours ne voient `/widget.js` que
 *    comme un actif HTTP : personne ne le regardait RENDU. Or le défaut 004 —
 *    « Répondez, ou corrigez la fiche au-dessus » alors qu’il n’y a pas de fiche
 *    — ne se voit qu’à l’écran, dans un état que seul un modèle absent produit.
 *
 * ⚠️ Le tour échoue POUR DE VRAI ici, en `503`. Rien n’est bouchonné côté
 *    widget, et l’ingestion, elle, rend bien `201`.
 *
 * ⛔ MAIS L’ÉCHEC EST LOCAL. `ANTHROPIC_BASE_URL` pointe sur un port que `fetch`
 *    refuse d’ouvrir : aucune requête ne quitte la machine, et le parcours
 *    échoue de la même façon partout. Il envoyait auparavant un vrai appel
 *    authentifié à api.anthropic.com — voir `playwright.config.ts`.
 *
 * ⛔ CE N’EST PAS UN VRAI HÔTE. `packages/widget/demo/index.html` est NOTRE page
 *    hostile, écrite en imaginant ce qui pourrait casser — T-003 reste ouvert et
 *    dit pourquoi. Ce parcours couvre ce qu’une fausse page peut couvrir : deux
 *    origines, CORS, l’isolation, et les mots affichés.
 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { CLE_DEMO_E2E, ORIGINE_DEMO } from '../../playwright.config'

const PAROLE = 'le tri par date se remet à zéro quand je reviens sur la page'

/**
 * ⚠️ La racine du widget est un shadow DOM **fermé** : ni Playwright ni la page
 *    hôte ne peuvent y entrer, et c’est l’invariant qu’on veut. On l’ouvre donc
 *    à l’instrumentation, AVANT le chargement, exactement comme le fait
 *    `montage.test.tsx`.
 *
 * ⛔ La page de démonstration n’est pas modifiée : l’instrumentation vit ici.
 * ⛔ Et l’invariant lui-même reste vérifié — par le dernier test de ce fichier,
 *    qui n’ouvre rien.
 */
async function ouvrirLaRacine(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const vrai = Element.prototype.attachShadow
    Element.prototype.attachShadow = function (init: ShadowRootInit): ShadowRoot {
      return vrai.call(this, { ...init, mode: 'open' })
    }
  })
}

/**
 * ⚠️ On ne retient que les VRAIES erreurs, et il n’en reste qu’une d’attendue :
 *    la ligne que le NAVIGATEUR écrit quand une requête rend 503 — ce parcours
 *    coupe le tour exprès. ⛔ Tout le reste est un défaut, et en particulier
 *    tout ce que le widget écrirait lui-même dans la console de l’hôte.
 *
 * ⚠️ L’avertissement de snapdom (T-005) est un `warning`, pas une erreur : il ne
 *    fait pas échouer ce parcours, et il reste un ticket ouvert.
 */
function surveillerLaConsole(page: Page): string[] {
  const erreurs: string[] = []
  /**
   * ⛔ UNE CONJONCTION, PAS UNE ALTERNANCE. C’était
   *    `/failed to load resource|503/i` : la première branche avalait
   *    N’IMPORTE QUEL échec de chargement — un `/snapdom.js` en 404, un
   *    `widget.js` en 500, un `ERR_CONNECTION_REFUSED` — et la seconde toute
   *    ligne contenant « 503 » où que ce soit. Le commentaire promettait
   *    « il n’en reste qu’UNE d’attendue » ; le filtre en laissait passer une
   *    famille entière, dans un fichier dont le premier parcours n’assère aucun
   *    code HTTP.
   *
   * ⚠️ Chrome écrit la ligne complète, l’URL vivant dans `location` et pas dans
   *    le texte : « Failed to load resource: the server responded with a status
   *    of 503 (Service Unavailable) ».
   */
  const attendue = /failed to load resource[\s\S]*status of 503(?![0-9])/i

  page.on('console', (message) => {
    if (message.type() !== 'error') return
    if (attendue.test(message.text())) return
    erreurs.push(message.text())
  })
  page.on('pageerror', (erreur) => erreurs.push(erreur.message))

  return erreurs
}

async function poserLeWidget(page: Page): Promise<void> {
  await page.goto(`${ORIGINE_DEMO}/?cle=${CLE_DEMO_E2E}`)
  await expect(page.locator('.lanceur')).toBeVisible()
}

test('le widget s’ouvre dans la page hostile, et rien de l’hôte ne le traverse', async ({ page }) => {
  const erreurs = surveillerLaConsole(page)
  await ouvrirLaRacine(page)
  await poserLeWidget(page)

  await page.locator('.lanceur').click()
  await expect(page.locator('.panneau')).toBeVisible()

  // ⛔ Le panneau doit rester lisible malgré le reset global et les `!important`
  //    de l’hôte.
  const rendu = await page.locator('.panneau').evaluate((panneau) => {
    const boite = panneau.getBoundingClientRect()
    const style = getComputedStyle(panneau)
    return {
      large: boite.width,
      haut: boite.height,
      police: style.fontFamily,
      casse: style.textTransform,
      interlettre: style.letterSpacing,
    }
  })

  expect(rendu.large).toBeGreaterThan(0)
  expect(rendu.haut).toBeGreaterThan(0)
  // ⚠️ L’hôte impose une police fantaisie à tout : si le panneau la portait, le
  //    shadow DOM aurait fui.
  expect(rendu.police.toLowerCase()).not.toContain('cursive')
  // ⛔ ET LES TROIS AUTRES FUITES HÉRITABLES. `index.html` impose aussi
  //    `text-transform: uppercase` et `letter-spacing: 0.14em` en `!important` ;
  //    seule `font-family` était vérifiée, et l’héritage traverse la frontière
  //    du shadow DOM — y compris fermé.
  expect(rendu.casse).toBe('none')
  expect(rendu.interlettre).toBe('normal')

  expect(erreurs).toEqual([])
})

/**
 * ⛔ LE Z-INDEX, QUI ÉTAIT PROMIS SANS ÊTRE VÉRIFIÉ.
 *
 * ⚠️ Le parcours ci-dessus annonçait « et passer AU-DESSUS de sa modale à
 *    `z-index: 9999` », et aucune de ses assertions ne regardait l’empilement.
 *    La modale de la page hostile est d’ailleurs en `display: none` tant que
 *    `#ouvrir-modale` n’a pas été cliqué — ce que le parcours ne faisait jamais.
 *
 * ⛔ C’est l’une des trois classes de défauts qui n’existent QUE chez un hôte
 *    (CLAUDE.md §Le widget ne se recette pas chez lui). Elle n’était pas testée.
 */
test('⛔ le widget passe au-dessus de la modale de l’hôte, et du bandeau ancré sous lui', async ({
  page,
}) => {
  const erreurs = surveillerLaConsole(page)
  await ouvrirLaRacine(page)
  await poserLeWidget(page)

  await page.locator('#ouvrir-modale').click()
  await expect(page.locator('.modale')).toBeVisible()

  // ⚠️ `elementFromPoint` retarge sur l’hôte du shadow DOM : ce qu’on lit est
  //    donc `feedys-widget` si le widget gagne, `.modale` ou `.bandeau` sinon.
  const dessus = await page.locator('.lanceur').evaluate((lanceur) => {
    const boite = lanceur.getBoundingClientRect()
    const cible = document.elementFromPoint(
      boite.left + boite.width / 2,
      boite.top + boite.height / 2,
    )
    if (cible === null) return 'rien'
    return `${cible.tagName.toLowerCase()}${cible.className ? `.${String(cible.className)}` : ''}`
  })

  // ⛔ Une modale de l’hôte par-dessus le lanceur, et Feedys devient
  //    inatteignable au moment précis où quelqu’un a quelque chose à dire.
  expect(dessus).toBe('feedys-widget')

  expect(erreurs).toEqual([])
})

test('⛔ tour coupé : l’invite du champ ne parle pas d’une fiche absente', async ({ page }) => {
  const erreurs = surveillerLaConsole(page)
  await ouvrirLaRacine(page)

  const appels: string[] = []
  page.on('response', (reponse) => {
    if (reponse.url().includes('/api/retours')) appels.push(`${reponse.status()}`)
  })

  await poserLeWidget(page)
  await page.locator('.lanceur').click()

  await page.locator('.champ').fill(PAROLE)
  await page.locator('.envoyer').click()

  // ⚠️ L’ingestion réussit, PUIS le tour échoue : c’est là que l’écran se fige
  //    dans l’état « en entretien, sans carte ».
  await expect(page.locator('.avis')).not.toBeEmpty({ timeout: 20_000 })

  expect(appels[0]).toBe('201')
  expect(appels).toContain('503')

  const champ = page.locator('.champ')

  // ⛔ LE DÉFAUT 004, TEL QU’IL SE VOYAIT : pas de carte, et pourtant une invite
  //    qui demandait d’en corriger une.
  await expect(page.locator('.carte')).toHaveCount(0)
  await expect(champ).toHaveAttribute('placeholder', 'Ajoutez ce qui vous revient.')
  await expect(champ).toHaveAttribute('aria-label', 'Votre réponse')

  // ⚠️ Et l’écran ne reste plus MUET : on cliquait, il ne se passait rien.
  await expect(page.locator('.avis')).toHaveText('C’est noté. Ajoutez ce que vous voulez, ou envoyez.')

  // ⛔ « Envoyer maintenant » n’est jamais désactivé pendant un entretien.
  await expect(page.locator('.envoyer')).toBeEnabled()
  await expect(page.locator('.envoyer')).toHaveText('Envoyer maintenant')

  // ⛔ Rien de ce qui est affiché ne s’excuse, n’explique la panne, ne promet.
  const invite = (await champ.getAttribute('placeholder')) ?? ''
  const avis = (await page.locator('.avis').textContent()) ?? ''
  const dit = `${avis} ${invite}`.toLowerCase()
  for (const interdit of ['désol', 'excus', 'erreur', 'indisponible', 'panne', 'réessay', 'bug']) {
    expect(dit).not.toContain(interdit)
  }

  expect(erreurs).toEqual([])
})

test('⛔ la racine du widget est FERMÉE — l’hôte ne peut pas y entrer', async ({ page }) => {
  // ⚠️ Sans instrumentation, cette fois : on regarde ce que l’hôte voit.
  await page.addInitScript(() => {
    const vrai = Element.prototype.attachShadow
    Element.prototype.attachShadow = function (init: ShadowRootInit): ShadowRoot {
      ;(window as unknown as { __modeFeedys?: string }).__modeFeedys = init.mode
      return vrai.call(this, init)
    }
  })

  await page.goto(`${ORIGINE_DEMO}/?cle=${CLE_DEMO_E2E}`)

  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __modeFeedys?: string }).__modeFeedys))
    .toBe('closed')

  // ⛔ Aucun `shadowRoot` accessible depuis la page : la racine est bien fermée.
  const traversables = await page.evaluate(
    () => [...document.querySelectorAll('*')].filter((noeud) => noeud.shadowRoot !== null).length,
  )

  expect(traversables).toBe(0)
})
