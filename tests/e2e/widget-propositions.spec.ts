/**
 * Les réponses d’un clic, RENDUES dans la page de quelqu’un d’autre.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE. `widget-demo.spec.ts` ne peut pas les montrer :
 *    le modèle y est hors ligne — `ANTHROPIC_BASE_URL` vise un port que `fetch`
 *    refuse d’ouvrir —, le tour rend donc `503` et aucun axe ne remonte jamais.
 *    Les boutons étaient couverts par `montage.test.tsx`, dans happy-dom. Or les
 *    trois classes de défauts qui comptent pour un widget embarqué **n’existent
 *    que chez un hôte** : les styles qui fuient, l’empilement, et ce qu’un vrai
 *    moteur fait du clavier (CLAUDE.md §Le widget ne se recette pas chez lui).
 *
 * ⛔ CE QUI EST BOUCHONNÉ EST LE TRANSPORT, PAS LE WIDGET. On intercepte la
 *    réponse de `POST /tour` pour obtenir un axe — le seul chose que le modèle
 *    absent nous refuse. Tout le reste est réel : l’ingestion part pour de vrai
 *    en `201`, le rendu est celui de Chromium, le clic est un vrai clic, et
 *    l’envoi qui suit repart vers le vrai serveur.
 *
 * ⛔ CE QU’ON NE PROUVE PAS ICI : que le SERVEUR rend le bon axe. C’est le
 *    travail de `tour.test.ts` (les verrous de `borner`) et de
 *    `tour.integration.test.ts` (les colonnes, contre un vrai Postgres). Ce
 *    parcours regarde l’écran, et rien d’autre.
 *
 * ⛔ ET CE N’EST TOUJOURS PAS UN VRAI HÔTE : `packages/widget/demo/index.html`
 *    est NOTRE page hostile. T-003 reste ouvert, et dit pourquoi.
 */
import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

import { CLE_DEMO_E2E, ORIGINE_DEMO } from '../../playwright.config'

const PAROLE = 'le tri par date se remet à zéro quand je reviens sur la page'

/** ⚠️ Écrite à la main. ⛔ Jamais un vrai retour copié d’une base. */
const CARTE = {
  type: 'bug',
  titre: 'Le tri par date de la liste des dossiers se réinitialise',
  resume: 'La personne repose le tri à chaque retour sur la liste.',
  ecran: 'Liste des dossiers',
}

/** Les libellés viennent du DÉPÔT (`ui/textes.ts`), jamais du modèle — D-025. */
const LIBELLES = ['C’est la première fois', 'C’est déjà arrivé', 'À chaque fois']

async function ouvrirLaRacine(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const vrai = Element.prototype.attachShadow
    Element.prototype.attachShadow = function (init: ShadowRootInit): ShadowRoot {
      return vrai.call(this, { ...init, mode: 'open' })
    }
  })
}

function surveillerLaConsole(page: Page): string[] {
  const erreurs: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') erreurs.push(message.text())
  })
  page.on('pageerror', (erreur) => erreurs.push(erreur.message))
  return erreurs
}

/**
 * Intercepte `POST /tour` et rend un axe.
 *
 * ⚠️ Le préflight est LAISSÉ AU VRAI SERVEUR : c’est lui qui répond `OPTIONS`,
 *    et le court-circuiter masquerait une régression de CORS — précisément l’un
 *    des deux points que ce parcours en deux origines existe pour couvrir.
 *
 * ⚠️ Le premier tour porte l’axe ; les suivants n’en portent plus et concluent.
 *    Sans ça, cliquer une proposition reposerait la même question à l’infini.
 */
async function bouchonnerLeTour(page: Page, corps: unknown[]): Promise<void> {
  await page.route('**/api/retours/*/tour', async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.continue()
      return
    }

    corps.push(route.request().postDataJSON())

    const premier = corps.length === 1
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'application/json',
        // ⚠️ Deux origines : sans cet en-tête, le navigateur jette la réponse
        //    et le widget croit que le tour a échoué.
        'access-control-allow-origin': ORIGINE_DEMO,
      },
      body: JSON.stringify({
        comprehension: CARTE,
        question: premier ? 'C’est déjà arrivé ?' : null,
        axe: premier ? 'recurrence' : null,
        motif: 'la récurrence change ce qu’un développeur ferait',
      }),
    })
  })
}

/** Ouvrir, dicter par écrit, envoyer : la parole part POUR DE VRAI en 201. */
async function entrerEnEntretien(page: Page): Promise<void> {
  await page.goto(`${ORIGINE_DEMO}/?cle=${CLE_DEMO_E2E}`)
  await expect(page.locator('.lanceur')).toBeVisible()
  await page.locator('.lanceur').click()
  await page.locator('.champ').fill(PAROLE)
  await page.locator('.envoyer').click()
  await expect(page.locator('.carte')).toBeVisible({ timeout: 20_000 })
}

test('les trois réponses s’affichent, écrites par le dépôt et pas par le modèle', async ({
  page,
}) => {
  const erreurs = surveillerLaConsole(page)
  await ouvrirLaRacine(page)
  await bouchonnerLeTour(page, [])
  await entrerEnEntretien(page)

  await expect(page.locator('.proposition')).toHaveCount(3)
  await expect(page.locator('.proposition')).toHaveText(LIBELLES)

  // ⛔ Le modèle n’a envoyé QUE `axe: 'recurrence'`. Ces mots-là ne sont jamais
  //    passés sur le fil : ils vivent dans `ui/textes.ts` (D-025).
  await expect(page.locator('.question')).toHaveText('C’est déjà arrivé ?')

  expect(erreurs).toEqual([])
})

/**
 * ⛔ LA CLASSE DE DÉFAUTS QUI N’EXISTE QUE CHEZ UN HÔTE.
 *
 * `demo/index.html` impose `font-family: cursive`, `text-transform: uppercase`
 * et `letter-spacing: 0.14em` en `!important` sur tout. Ces trois propriétés
 * sont HÉRITABLES et traversent la frontière du shadow DOM, y compris fermé.
 * Un bouton dont le libellé passe en majuscules avec 0,14em d’interlettre n’est
 * pas un détail : « C’EST LA PREMIÈRE FOIS » déborde et se coupe.
 */
test('⛔ les styles de l’hôte ne les traversent pas', async ({ page }) => {
  const erreurs = surveillerLaConsole(page)
  await ouvrirLaRacine(page)
  await bouchonnerLeTour(page, [])
  await entrerEnEntretien(page)

  // ⛔ D’ABORD : LA PAGE EST-ELLE VRAIMENT HOSTILE ? Sans ce contrôle, ce test
  //    passerait tout aussi bien si `index.html` avait perdu son reset — il
  //    prouverait alors l’isolation contre une page inoffensive, c’est-à-dire
  //    rien du tout. C’est le même garde-fou que « trouve bien des sources à
  //    examiner » dans `budget.test.ts`.
  const hote = await page.locator('#ouvrir-modale').evaluate((element) => {
    const style = getComputedStyle(element)
    return { casse: style.textTransform, police: style.fontFamily }
  })

  expect(hote.casse).toBe('uppercase')
  expect(hote.police.toLowerCase()).toContain('cursive')

  const rendu = await page.locator('.proposition').first().evaluate((bouton) => {
    const style = getComputedStyle(bouton)
    const boite = bouton.getBoundingClientRect()
    return {
      police: style.fontFamily,
      casse: style.textTransform,
      interlettre: style.letterSpacing,
      radius: style.borderRadius,
      haut: boite.height,
      large: boite.width,
    }
  })

  expect(rendu.police.toLowerCase()).not.toContain('cursive')
  expect(rendu.casse).toBe('none')
  expect(rendu.interlettre).toBe('normal')
  // ⚠️ L’hôte impose `border-radius: 0 !important` : un bouton carré ici
  //    signalerait que le reset du widget a cédé.
  expect(rendu.radius).not.toBe('0px')
  // ⛔ 44 px de cible tactile : ces boutons existent pour être touchés vite.
  expect(rendu.haut).toBeGreaterThanOrEqual(44)
  expect(rendu.large).toBeGreaterThan(0)

  expect(erreurs).toEqual([])
})

test('⛔ ils restent atteignables au-dessus de la modale de l’hôte', async ({ page }) => {
  const erreurs = surveillerLaConsole(page)
  await ouvrirLaRacine(page)
  await bouchonnerLeTour(page, [])
  await entrerEnEntretien(page)

  await page.locator('#ouvrir-modale').click()
  await expect(page.locator('.modale')).toBeVisible()

  // ⚠️ `elementFromPoint` retarge sur l’hôte du shadow DOM : on lit
  //    `feedys-widget` si le widget gagne, `.modale` sinon.
  const dessus = await page.locator('.proposition').first().evaluate((bouton) => {
    const boite = bouton.getBoundingClientRect()
    const cible = document.elementFromPoint(
      boite.left + boite.width / 2,
      boite.top + boite.height / 2,
    )
    return cible === null ? 'rien' : cible.tagName.toLowerCase()
  })

  expect(dessus).toBe('feedys-widget')

  expect(erreurs).toEqual([])
})

test('⛔ un clic envoie la VALEUR, jamais le libellé — et conclut le retour', async ({ page }) => {
  const erreurs = surveillerLaConsole(page)
  const envoyes: unknown[] = []
  await ouvrirLaRacine(page)
  await bouchonnerLeTour(page, envoyes)
  await entrerEnEntretien(page)

  await page.locator('.proposition').nth(2).click()

  // ⛔ Plus de question : le widget conclut tout seul, et l’envoi part vers le
  //    VRAI serveur. On ne retient personne.
  await expect(page.locator('.accuse')).toBeVisible({ timeout: 20_000 })

  expect(envoyes).toHaveLength(2)
  expect(envoyes[1]).toMatchObject({ axe: 'recurrence', valeurAxe: 'systematique' })
  // ⛔ ET SURTOUT : le libellé du bouton n’a traversé nulle part.
  expect(JSON.stringify(envoyes[1])).not.toContain('À chaque fois')

  expect(erreurs).toEqual([])
})

test('⛔ le clavier y accède, et ce n’est pas un choix obligatoire', async ({ page }) => {
  const erreurs = surveillerLaConsole(page)
  const envoyes: unknown[] = []
  await ouvrirLaRacine(page)
  await bouchonnerLeTour(page, envoyes)
  await entrerEnEntretien(page)

  // ⛔ Ni radiogroup, ni radio : annoncer un choix obligatoire dirait à un
  //    lecteur d’écran qu’il faut trancher parmi trois options (D-025).
  await expect(page.locator('[role="radiogroup"]')).toHaveCount(0)
  await expect(page.locator('[role="radio"]')).toHaveCount(0)
  await expect(page.locator('.propositions')).toHaveAttribute('role', 'group')

  // ⚠️ Le champ texte et le micro restent là : la parole n’est pas remplacée.
  await expect(page.locator('.champ')).toBeVisible()
  // ⛔ Et « Envoyer maintenant » n’est jamais désactivé pendant un entretien.
  await expect(page.locator('.envoyer')).toBeEnabled()

  // Atteint au clavier, et actionné à l’Entrée comme n’importe quel bouton.
  await page.locator('.proposition').first().focus()
  const focalise = await page.evaluate(() => {
    const racine = document.querySelector('feedys-widget')?.shadowRoot
    return racine?.activeElement?.className ?? 'rien'
  })
  expect(focalise).toContain('proposition')

  await page.keyboard.press('Enter')
  await expect(page.locator('.accuse')).toBeVisible({ timeout: 20_000 })
  expect(envoyes[1]).toMatchObject({ axe: 'recurrence', valeurAxe: 'premiere_fois' })

  expect(erreurs).toEqual([])
})
