/**
 * `/widget.js` tel qu’un hôte le reçoit.
 *
 * ⛔ CE PARCOURS EXISTE À CAUSE D’UN BUG RÉEL (03-Bugs/BUGS_LOG.md 001). Le
 *    budget de 60 Ko était tenu par `packages/widget/src/budget.test.ts`, qui
 *    gzippe le fichier CONSTRUIT — pendant que la route le servait en clair,
 *    74,9 Ko sur le fil. Le budget était vert et faux en même temps, ce qui est
 *    la pire des deux situations.
 *
 * ⚠️ D’où la mesure ici, et pas ailleurs : c’est le seul endroit où le fichier
 *    passe par la route, avec les en-têtes qu’un navigateur envoie vraiment.
 */
import { expect, test } from '@playwright/test'

/** 60 Ko gzip (01-Specs/widget.md §4). */
const BUDGET = 60 * 1024

test('sert widget.js compressé, sous le budget, tel qu’un navigateur le demande', async ({
  request,
}) => {
  const reponse = await request.get('/widget.js', {
    headers: { 'accept-encoding': 'gzip, deflate, br' },
  })

  expect(reponse.status()).toBe(200)

  const encodage = reponse.headers()['content-encoding']
  expect(encodage, 'widget.js part en clair : le budget serait faux chez l’hôte').toBeDefined()
  expect(['br', 'gzip']).toContain(encodage)

  // ⛔ Sans lui, un cache partagé sert du brotli à qui n’en veut pas.
  expect(reponse.headers()['vary']).toContain('Accept-Encoding')

  const octets = Number(reponse.headers()['content-length'])
  expect(octets, `widget.js pèse ${(octets / 1024).toFixed(1)} Ko sur le fil`).toBeLessThanOrEqual(
    BUDGET,
  )
})

test('sert le script à toutes les origines, et cinq minutes seulement', async ({ request }) => {
  const entetes = (await request.get('/widget.js')).headers()

  expect(entetes['access-control-allow-origin']).toBe('*')
  // ⚠️ Un hôte qui active COEP bloquerait le script sans cet en-tête.
  expect(entetes['cross-origin-resource-policy']).toBe('cross-origin')
  // ⚠️ Cinq minutes, pas un an : c’est notre cache qui décide de la vitesse de
  //    propagation d’un correctif chez quatre logiciels qui ne redéploient pas.
  expect(entetes['cache-control']).toContain('max-age=300')
})

test('⛔ ne réclame pas de favicon — une 404 est une erreur de console', async ({ request }) => {
  const reponse = await request.get('/icon.svg')

  expect(reponse.status()).toBe(200)
  expect(reponse.headers()['content-type']).toContain('image/svg+xml')
})
