/**
 * Ce que Feedys EXIGE de la politique de sécurité de contenu de son hôte.
 *
 * ⛔ POURQUOI CE PARCOURS EXISTE. Le widget posait sa feuille dans un `<style>`,
 *    et un `<style>` est du **style en ligne** pour le navigateur, même enfermé
 *    dans un shadow DOM. Sous un CSP strict, il était refusé : le lanceur
 *    devenait un bouton système gris et carré de 59 px, et la console de l’hôte
 *    portait une erreur rouge. Le widget marchait, mais il avait l’air cassé —
 *    et c’était nous ([P-027](../../05-Prompts/APRES-MVP.md), 03-Bugs/BUGS_LOG.md 018).
 *
 * ⚠️ CE FICHIER EST L’INSTRUMENT DE MESURE DE `hebergement.md` §La pose chez un
 *    hôte. La liste de directives qu’on y publie n’est pas devinée : elle est
 *    relevée ici, et chaque ligne de la liste a son test. ⛔ Y compris ce qui
 *    n’est PAS exigé — une liste trop large fait relâcher une politique sans
 *    raison, et personne ne la resserre ensuite.
 *
 * ⚠️ Deux montages, parce qu’ils ne prouvent pas la même chose :
 *    - **même origine** (`'self'` suffit à tout) : ne reste que `style-src`,
 *      donc NOTRE feuille, isolée ;
 *    - **origines croisées**, sur le vrai serveur de démonstration : c’est le
 *      seul montage qui ressemble à la pose réelle, et le seul où l’on peut
 *      dire à un intégrateur ce qu’il doit écrire.
 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { CLE_DEMO_E2E, ORIGINE, ORIGINE_DEMO } from '../../playwright.config'

const PAROLE = 'le tri par date se remet à zéro quand je reviens sur la page'

/** ⛔ Le CSP de P-027, mot pour mot. Aucun `unsafe-inline`, nulle part. */
const STRICT_MEME_ORIGINE = `default-src 'self'; script-src 'self'; connect-src 'self'`

/**
 * ⛔ LA LIGNE PUBLIÉE DANS `hebergement.md`. Si elle change là-bas, elle change
 *    ici, et l’inverse : c’est le même fait écrit deux fois.
 *
 * ⚠️ Le `'self'` de `script-src` n’est pas à nous : c’est le script d’identité de
 *    l’hôte, que tout hôte autorise déjà pour ses propres fichiers. Ce que
 *    Feedys ajoute, et **tout** ce qu’il ajoute, c’est son origine dans
 *    `script-src` et dans `connect-src`.
 */
const MINIMALE_CROISEE = `default-src 'none'; script-src 'self' ${ORIGINE}; connect-src ${ORIGINE}`

interface Violation {
  readonly directive: string
  readonly bloque: string
}

/**
 * ⚠️ On relève les violations à la SOURCE — l’événement `securitypolicyviolation`
 *    —, pas en lisant la console. La console dit la même chose en anglais et en
 *    prose ; l’événement donne la directive et l’URI bloquée, c’est-à-dire
 *    exactement ce qu’on publie.
 *
 * ⚠️ `attachShadow` est ouvert au passage : la racine est FERMÉE, et c’est le
 *    seul moyen d’aller lire la feuille adoptée. L’invariant lui-même est tenu
 *    par `widget-demo.spec.ts`.
 */
async function instrumenter(page: Page, options: { sansCapture?: boolean } = {}): Promise<void> {
  await page.addInitScript(() => {
    const releve: Violation[] = []
    ;(window as unknown as { __violations: Violation[] }).__violations = releve
    document.addEventListener('securitypolicyviolation', (evenement) => {
      const e = evenement as SecurityPolicyViolationEvent
      releve.push({ directive: e.effectiveDirective || e.violatedDirective, bloque: e.blockedURI })
    })

    const vrai = Element.prototype.attachShadow
    Element.prototype.attachShadow = function (init: ShadowRootInit): ShadowRoot {
      return vrai.call(this, { ...init, mode: 'open' })
    }
  })

  if (options.sansCapture === true) {
    // ⚠️ NEUTRALISER LA CAPTURE SANS ÉCRIRE UNE LIGNE EN CONSOLE. Un `200` au
    //    corps vide : le `load` du `<script>` part, `globalThis.snapdom` reste
    //    indéfini, `charger()` rend `undefined`, la capture est absente. C’est
    //    l’échec doux que [D-011] garantit déjà. ⛔ Un `abort()` écrirait un
    //    `net::ERR_FAILED` et on ne saurait plus ce qu’on mesure.
    await page.route('**/snapdom.js', (route) =>
      route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }),
    )
  }
}

/**
 * ⚠️ Une seule ligne d’erreur est attendue, et c’est celle que le NAVIGATEUR
 *    écrit quand le tour rend 503 : le modèle est volontairement injoignable en
 *    e2e (voir `playwright.config.ts`). ⛔ Tout le reste est un défaut. Le
 *    filtre est celui de `widget-demo.spec.ts`, et pour la même raison.
 */
const ERREUR_ATTENDUE = /failed to load resource[\s\S]*status of 503(?![0-9])/i

function surveillerLaConsole(page: Page): string[] {
  const erreurs: string[] = []

  page.on('console', (message) => {
    if (message.type() !== 'error') return
    if (ERREUR_ATTENDUE.test(message.text())) return
    erreurs.push(message.text())
  })
  page.on('pageerror', (erreur) => erreurs.push(erreur.message))

  return erreurs
}

/**
 * La page de l’hôte, servie par l’ORIGINE FEEDYS, avec son CSP en `<meta>`.
 *
 * ⚠️ Elle est **nue** : pas un style, pas un script à elle. C’est la condition
 *    pour qu’une violation observée soit forcément la nôtre.
 *
 * ⚠️ Elle est fournie par Playwright plutôt que par une route du serveur : le
 *    navigateur la tient pour une page de l’origine Feedys — c’est tout ce dont
 *    `'self'` dépend —, et `apps/serveur` n’a pas à porter une route qui
 *    n’existerait que pour un test. Le pendant croisé, lui, vient d’un VRAI
 *    serveur : `packages/widget/demo/serveur.ts` §`/csp`.
 */
async function poserLaPageFeedys(page: Page, csp: string): Promise<void> {
  const url = `${ORIGINE}/hote-sous-csp`

  await page.route(url, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>Un hôte sous CSP</title>
</head>
<body>
<h1>Une page d’hôte sans un seul style ni script à elle</h1>
<script src="${ORIGINE}/widget.js" data-cle="${CLE_DEMO_E2E}" defer></script>
</body>
</html>`,
    }),
  )

  await page.goto(url)
}

/** ⛔ Le parcours ne s’arrête pas au chargement : une violation peut n’arriver
 *     qu’au premier `fetch`, ou à l’ouverture du panneau avec snapdom. */
async function ouvrirEcrireEnvoyer(page: Page): Promise<void> {
  await page.locator('.lanceur').click()
  await expect(page.locator('.panneau')).toBeVisible()
  await page.locator('.champ').fill(PAROLE)
  await page.locator('.envoyer').click()
  await expect(page.locator('.avis')).not.toBeEmpty({ timeout: 20_000 })
}

async function violations(page: Page): Promise<Violation[]> {
  return page.evaluate(() => (window as unknown as { __violations: Violation[] }).__violations)
}

/** Ce que la racine fantôme porte réellement — le chemin pris s’y LIT. */
async function feuilleDe(page: Page): Promise<{ adoptees: number; regles: number; balises: number }> {
  return page.evaluate(() => {
    const racine = document.querySelector('feedys-widget')?.shadowRoot
    return {
      adoptees: racine?.adoptedStyleSheets.length ?? -1,
      regles: racine?.adoptedStyleSheets[0]?.cssRules.length ?? -1,
      balises: racine?.querySelectorAll('style').length ?? -1,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Même origine — NOTRE feuille, isolée
// ─────────────────────────────────────────────────────────────────────────────

test('⛔ sous un CSP strict SANS unsafe-inline, le widget est habillé et la console reste vide', async ({
  page,
}) => {
  const erreurs = surveillerLaConsole(page)
  await instrumenter(page, { sansCapture: true })
  await poserLaPageFeedys(page, STRICT_MEME_ORIGINE)

  await expect(page.locator('.lanceur')).toBeVisible()

  // ⛔ LES TROIS MESURES DE P-027, ET C’EST TOUT CE QUI SÉPARE « habillé » de
  //    « bouton système gris et carré » : sans la feuille, le fond valait
  //    rgb(240,240,240), le rayon 0px et la hauteur 59px.
  const lanceur = await page.locator('.lanceur').evaluate((noeud) => {
    const style = getComputedStyle(noeud)
    return {
      fond: style.backgroundColor,
      rayon: style.borderRadius,
      hauteur: Math.round(noeud.getBoundingClientRect().height),
    }
  })

  // ⚠️ Le fond du lanceur est comparé au token RÉSOLU, jamais à un hex recopié
  //    ici : aucune couleur en dur hors de `ui/tokens.ts` (DESIGN.md).
  expect(lanceur.fond).toBe(await couleurDuToken(page, '--w-accent'))
  expect(lanceur.rayon).toBe('999px')
  expect(lanceur.hauteur).toBe(48)

  // ⛔ LA FEUILLE EST ADOPTÉE, ET IL N’Y A AUCUN <style>. C’est là que se lit le
  //    chemin réellement pris — aucun drapeau, aucune version ne le dit.
  const feuille = await feuilleDe(page)
  expect(feuille.adoptees).toBe(1)
  expect(feuille.regles).toBeGreaterThan(0)
  expect(feuille.balises).toBe(0)

  await ouvrirEcrireEnvoyer(page)

  expect(await violations(page)).toEqual([])
  expect(erreurs).toEqual([])
})

/**
 * ⛔ CE QUI RESTE, ET QUI N’EST PAS À NOUS DE CORRIGER. La capture d’écran
 *    (`@zumer/snapdom`, [D-011]) pose un `<style>` dans le document de l’hôte et
 *    charge un SVG en `data:` — deux choses qu’un CSP strict refuse. La capture
 *    est alors simplement absente, l’envoi part quand même (l’échec doux est la
 *    règle), mais la console de l’hôte porte deux lignes rouges.
 *
 * ⚠️ Ce test ÉPINGLE cette dette : ni plus, ni moins que ces deux violations. Le
 *    jour où snapdom en ajoute une troisième, ou en retire une, c’est ici qu’on
 *    l’apprend — et `hebergement.md` doit suivre. Le ticket est
 *    [T-010](../../00-Projet/TICKETS_DIFFERES.md).
 */
test('⛔ la capture, elle, coûte encore deux directives — et exactement deux', async ({ page }) => {
  await instrumenter(page)
  await poserLaPageFeedys(page, STRICT_MEME_ORIGINE)

  await expect(page.locator('.lanceur')).toBeVisible()
  await ouvrirEcrireEnvoyer(page)

  // ⚠️ Triées : l’ordre dépend de l’ordre interne de snapdom, pas de nous.
  const relevees = (await violations(page))
    .map((v) => `${v.directive} ← ${v.bloque}`)
    .sort()

  expect(relevees).toEqual(['img-src ← data', 'style-src-elem ← inline'])

  // ⚠️ Et le retour part quand même : c’est tout ce qui compte. La capture
  //    manque, personne ne perd la parole.
  await expect(page.locator('.envoyer')).toBeEnabled()
})

// ─────────────────────────────────────────────────────────────────────────────
// Origines croisées — ce qu’on écrit à un intégrateur
// ─────────────────────────────────────────────────────────────────────────────

/** L’hôte sur son port, Feedys sur le sien, et un vrai serveur des deux côtés. */
function urlCroisee(politique: string): string {
  return `${ORIGINE_DEMO}/csp?politique=${encodeURIComponent(politique)}&cle=${CLE_DEMO_E2E}`
}

test('⛔ la ligne de CSP publiée SUFFIT, depuis une autre origine, jusqu’à l’envoi', async ({
  page,
}) => {
  const erreurs = surveillerLaConsole(page)
  await instrumenter(page, { sansCapture: true })

  const appels: string[] = []
  page.on('response', (reponse) => {
    if (reponse.url().includes('/api/retours')) appels.push(`${reponse.request().method()} ${reponse.status()}`)
  })

  await page.goto(urlCroisee(MINIMALE_CROISEE))
  await expect(page.locator('.lanceur')).toBeVisible()

  const feuille = await feuilleDe(page)
  expect(feuille.adoptees).toBe(1)
  expect(feuille.balises).toBe(0)

  await ouvrirEcrireEnvoyer(page)

  // ⛔ La parole est ARRIVÉE. Une politique qui laisse monter le widget mais
  //    bloque l’ingestion serait pire qu’une politique qui bloque tout.
  expect(appels).toContain('POST 201')
  // ⚠️ ET LA RELÈVE AUSSI : elle part au montage, sur la même origine et donc
  //    sous la même directive. C’est la moitié de `connect-src` qu’un parcours
  //    d’envoi seul ne verrait pas. ⛔ Elle n’existe que si l’hôte a posé une
  //    identité — ici en FONCTION, la forme recommandée.
  expect(appels).toContain('GET 200')
  expect(await violations(page)).toEqual([])
  expect(erreurs).toEqual([])
})

/**
 * ⛔ NI PLUS LARGE, NI PLUS ÉTROITE. Les deux moitiés de la liste publiée :
 *    ce qui manque casse quelque chose, et ce qu’on n’y met pas ne manque à
 *    personne.
 */
test('⛔ retirer connect-src coupe la parole — la directive est bien exigée', async ({ page }) => {
  await instrumenter(page, { sansCapture: true })
  await page.goto(urlCroisee(`default-src 'none'; script-src 'self' ${ORIGINE}`))

  // ⚠️ Le widget MONTE quand même, et c’est le pire des cas : la bulle est là,
  //    quelqu’un parle, et rien ne part. Une politique incomplète ne se voit pas.
  await expect(page.locator('.lanceur')).toBeVisible()

  await page.locator('.lanceur').click()
  await expect(page.locator('.panneau')).toBeVisible()
  await page.locator('.champ').fill(PAROLE)
  await page.locator('.envoyer').click()

  await expect
    .poll(async () => (await violations(page)).map((v) => v.directive))
    .toContain('connect-src')
})

test('⛔ style-src et img-src fermés au plus dur ne gênent rien — on ne les publie donc pas', async ({
  page,
}) => {
  const erreurs = surveillerLaConsole(page)
  await instrumenter(page, { sansCapture: true })

  // ⛔ `'none'` est plus dur que `'self'` : si le widget passe là, il passe
  //    partout. C’est la preuve qu’après la feuille adoptée, `style-src` ne lui
  //    sert plus à rien — et qu’`img-src` ne lui a jamais servi.
  await page.goto(urlCroisee(`${MINIMALE_CROISEE}; style-src 'none'; img-src 'none'`))

  await expect(page.locator('.lanceur')).toBeVisible()
  expect(await page.locator('.lanceur').evaluate((n) => getComputedStyle(n).borderRadius)).toBe('999px')

  await ouvrirEcrireEnvoyer(page)

  expect(await violations(page)).toEqual([])
  expect(erreurs).toEqual([])
})

/** La valeur du token, lue là où il est défini — jamais un hex recopié ici. */
async function couleurDuToken(page: Page, token: string): Promise<string> {
  return page.evaluate((nom) => {
    const racine = document.querySelector('feedys-widget')?.shadowRoot
    const conteneur = racine?.querySelector('.racine')
    if (!conteneur) return ''
    const sonde = document.createElement('span')
    sonde.style.color = `var(${nom})`
    conteneur.appendChild(sonde)
    const couleur = getComputedStyle(sonde).color
    sonde.remove()
    return couleur
  }, token)
}
