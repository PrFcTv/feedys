/**
 * `pnpm widget:demo` — la fausse application hôte, volontairement hostile.
 *
 * ⛔ LE WIDGET NE SE RECETTE PAS DANS LE BACK-OFFICE. Il vit dans un shadow DOM
 *    injecté dans la page d’autrui ; trois classes de défauts n’existent que là
 *    et sont invisibles ailleurs — les styles qui fuient, le z-index, les
 *    collisions de globales. Voir CLAUDE.md §Le widget ne se recette pas chez
 *    lui.
 *
 * ⚠️ La page charge `widget.js` depuis le SERVEUR Feedys, pas depuis ce serveur-
 *    ci. C’est le seul montage qui recette aussi les en-têtes de cache, CORS, et
 *    le chargement de `/snapdom.js` — donc `pnpm dev` doit tourner à côté.
 *
 * ⚠️ Un autre port que celui du serveur, exprès : le widget poste vers une autre
 *    origine, exactement comme chez un hôte. `origineAutorisee` ignore le port,
 *    un produit créé sur le domaine `localhost` suffit donc.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const PAGE = path.join(ICI, 'index.html')

const PORT = Number(process.env.PORT ?? 4321)
const FEEDYS = (process.env.FEEDYS_URL ?? 'http://localhost:3000').replace(/\/+$/, '')

/**
 * ⛔ Une clé publique et rien d’autre. Le dépôt est public : aucune vraie clé ne
 *    s’écrit ici, elle vient de `.env.local` ou de la barre d’adresse.
 */
const FORME_CLE = /^fdy_pub_[A-Za-z0-9_-]{1,64}$/

chargerEnvLocal()

const CLE_PAR_DEFAUT = process.env.FEEDYS_CLE_DEMO ?? ''

const serveur = createServer((requete, reponse) => {
  const url = new URL(requete.url ?? '/', `http://localhost:${PORT}`)

  // ⚠️ La console du navigateur est un résultat de test (DESIGN.md) : un 404 de
  //    favicon suffirait à faire douter de ce qu’on recette.
  if (url.pathname === '/favicon.ico') {
    reponse.writeHead(204)
    reponse.end()
    return
  }

  if (url.pathname !== '/') {
    reponse.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    reponse.end('Rien ici. La page de recette est sur /.\n')
    return
  }

  void servirPage(url.searchParams.get('cle'))
    .then((html) => {
      reponse.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        // ⚠️ Aucun cache : on recette, on recharge, on recommence.
        'cache-control': 'no-store',
      })
      reponse.end(html)
    })
    .catch(() => {
      reponse.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      reponse.end('La page de recette est illisible.\n')
    })
})

serveur.listen(PORT, () => {
  const cle = choisirCle(null)
  console.log(`\n  Fausse application hôte : http://localhost:${PORT}`)
  console.log(`  Widget chargé depuis     : ${FEEDYS}/widget.js`)
  console.log(
    cle === ''
      ? '  ⚠️  Aucune clé. Passez-la dans l’URL : ?cle=fdy_pub_… ou par FEEDYS_CLE_DEMO.\n'
      : `  Clé publique             : ${cle}\n`,
  )
})

async function servirPage(cleDemandee: string | null): Promise<string> {
  const gabarit = await readFile(PAGE, 'utf8')

  return gabarit.replaceAll('__FEEDYS_URL__', FEEDYS).replaceAll('__FEEDYS_CLE__', choisirCle(cleDemandee))
}

/**
 * ⚠️ La clé traverse la barre d’adresse : on la valide avant de l’écrire dans du
 *    HTML. Ce serveur ne sert qu’en développement, mais une page de recette qui
 *    accepte n’importe quoi finit par apprendre à quelqu’un que c’est normal.
 */
function choisirCle(demandee: string | null): string {
  const candidate = demandee?.trim() ?? CLE_PAR_DEFAUT.trim()
  return FORME_CLE.test(candidate) ? candidate : ''
}

/**
 * ⚠️ `.env.local` est ignoré par git et contient déjà la clé du produit de
 *    démonstration. ⛔ On ne demande jamais à l’humain de recoller un secret
 *    dans une conversation : il l’a déjà donné (CLAUDE.md).
 */
function chargerEnvLocal(): void {
  try {
    process.loadEnvFile('.env.local')
  } catch {
    // Pas de fichier, pas de problème : la clé peut venir de l’URL.
  }
}
