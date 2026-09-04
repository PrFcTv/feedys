/**
 * Le parcours du back-office : ouvrir, filtrer, ouvrir une fiche, changer le
 * statut.
 *
 * ⛔ **La console du navigateur est un résultat de test.** Une erreur de console
 *    fait échouer le parcours (04-Architecture/DESIGN.md §Ce qui vaut pour les
 *    deux).
 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { MOT_DE_PASSE_E2E } from '../../playwright.config'

import { PAROLE_BUG, TITRE_BUG, TITRE_IDEE } from './preparer'

/**
 * ⚠️ Le serveur de développement de Next parle en console pour ses propres
 *    besoins. On ne retient que les VRAIES erreurs : `console.error` et les
 *    exceptions non rattrapées.
 */
function surveillerLaConsole(page: Page): string[] {
  const erreurs: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') erreurs.push(message.text())
  })
  page.on('pageerror', (erreur) => erreurs.push(erreur.message))

  return erreurs
}

/** ⚠️ Une section se repère par son titre : c’est ce que le lecteur voit. */
function section(page: Page, titre: string) {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: titre }) })
}

async function seConnecter(page: Page): Promise<void> {
  await page.goto('/bo')

  // ⛔ Sans session, on est renvoyé vers la connexion.
  await expect(page).toHaveURL(/\/connexion/)

  await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE_E2E)
  await page.getByRole('button', { name: 'Entrer' }).click()

  await expect(page.getByRole('heading', { name: 'Les retours' })).toBeVisible()
}

/** ⚠️ Le select est un composant Base UI : on ouvre, puis on choisit. */
async function choisir(page: Page, etiquette: string, option: string): Promise<void> {
  await page.getByRole('combobox', { name: etiquette }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

test('ouvrir, filtrer, ouvrir une fiche, changer le statut', async ({ page }) => {
  const erreurs = surveillerLaConsole(page)

  await seConnecter(page)

  // ── la liste ──────────────────────────────────────────────────────────────
  await expect(page.getByText(TITRE_BUG)).toBeVisible()
  await expect(page.getByText(TITRE_IDEE)).toBeVisible()

  // ── filtrer ───────────────────────────────────────────────────────────────
  await choisir(page, 'Type', 'bug')
  await page.getByRole('button', { name: 'Filtrer' }).click()

  await expect(page).toHaveURL(/type=bug/)
  await expect(page.getByText(TITRE_BUG)).toBeVisible()
  await expect(page.getByText(TITRE_IDEE)).toHaveCount(0)

  // ── la fiche ──────────────────────────────────────────────────────────────
  await page.getByText(TITRE_BUG).click()
  await expect(page.getByRole('heading', { name: TITRE_BUG })).toBeVisible()

  // ⛔ LE FIL BRUT EST VISIBLE SANS UN CLIC. Pas de « voir les détails ».
  await expect(page.getByText(PAROLE_BUG)).toBeVisible()

  // ⛔ Et dans l’ordre imposé : la note, PUIS le fil, PUIS le contexte.
  const sections = await page.getByRole('heading', { level: 2 }).allTextContents()
  expect(sections).toEqual([
    'La note',
    'Corriger',
    'Le fil de l’entretien',
    'Le contexte technique',
  ])

  // ── changer le statut ─────────────────────────────────────────────────────
  await expect(page.getByText('envoyé', { exact: true })).toBeVisible()

  await choisir(page, 'Statut', 'traité')
  await page.getByRole('button', { name: 'Changer le statut' }).click()

  await expect(page.getByText('traité', { exact: true }).first()).toBeVisible()

  expect(erreurs).toEqual([])
})

test('⛔ le fil brut ne se replie pas — il est visible sans un clic', async ({ page }) => {
  const erreurs = surveillerLaConsole(page)

  await seConnecter(page)
  await page.getByText(TITRE_BUG).click()

  const fil = section(page, 'Le fil de l’entretien')

  // ⛔ Pas de « voir les détails », pas d’accordéon : la parole est là, entière.
  await expect(fil.getByText(PAROLE_BUG)).toBeVisible()
  await expect(page.locator('details')).toHaveCount(0)

  // ⛔ Et aucun moyen de la toucher : pas un champ, pas un bouton dans le fil.
  await expect(fil.locator('input, textarea, button, [contenteditable]')).toHaveCount(0)

  expect(erreurs).toEqual([])
})

test('⛔ une tentative de modifier la parole est refusée CÔTÉ SERVEUR', async ({ page }) => {
  await seConnecter(page)
  await page.getByText(TITRE_BUG).click()

  const resume = 'Le tri par date se réinitialise au retour sur la page.'
  await expect(page.getByText(resume)).toBeVisible()

  // ⚠️ On forge le formulaire depuis la page, exactement comme quelqu’un le
  //    ferait avec la console : un champ de plus, qui vise le résumé.
  const formulaire = section(page, 'Corriger').locator('form').last()
  await formulaire.evaluate((element) => {
    const intrus = document.createElement('input')
    intrus.name = 'resume'
    intrus.value = 'un résumé de mon cru'
    element.appendChild(intrus)
  })

  await page.getByRole('button', { name: 'Corriger l’étiquette' }).click()

  // ⛔ Refusé, et DIT : pas ignoré en silence.
  //    ⚠️ Borné à la section : Next pose son propre `role="alert"` pour annoncer
  //       les changements de route.
  await expect(section(page, 'Corriger').getByRole('alert')).toContainText('Refusé')

  await page.reload()
  await expect(page.getByText(resume)).toBeVisible()
  await expect(page.getByText('un résumé de mon cru')).toHaveCount(0)
})

test('le pied de page porte le lien vers la source — article 13 de l’AGPL', async ({ page }) => {
  await seConnecter(page)

  const lien = page.getByRole('link', { name: 'le code source de cette version' })
  await expect(lien).toBeVisible()
  await expect(lien).toHaveAttribute('href', /github\.com/)
})

test('l’état vide dit quoi faire ensuite', async ({ page }) => {
  await seConnecter(page)

  // ⚠️ Une zone qui n’existe pas : la liste est vide À CAUSE DES FILTRES.
  await page.goto('/bo?zone=une-zone-qui-nexiste-pas')

  await expect(page.getByRole('heading', { name: 'Rien ne correspond à ces filtres' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Voir tous les retours' })).toBeVisible()
})
