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
import type { ServerResponse } from 'node:http'
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

  if (url.pathname === '/csp') {
    servirLaPageNue(reponse, url.searchParams)
    return
  }

  if (url.pathname === '/csp-identite.js') {
    servirLIdentite(reponse)
    return
  }

  if (url.pathname !== '/') {
    reponse.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    reponse.end('Rien ici. La page de recette est sur / et sur /csp.\n')
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
  console.log(`  La même chose sous CSP   : http://localhost:${PORT}/csp`)
  console.log(
    cle === ''
      ? '  ⚠️  Aucune clé. Passez-la dans l’URL : ?cle=fdy_pub_… ou par FEEDYS_CLE_DEMO.\n'
      : `  Clé publique             : ${cle}\n`,
  )
})

/**
 * `/csp` — la même pose, mais sous une politique de sécurité de contenu, et sur
 * une page **NUE**.
 *
 * ⚠️ POURQUOI NUE, alors que `/` est volontairement hostile. Ici on ne recette
 *    pas l’hostilité, on **mesure** : la page de `/` porte ses propres styles et
 *    scripts en ligne, et chaque violation qu’ils déclenchent viendrait brouiller
 *    la lecture. Sur une page sans un seul style ni script à elle, toute
 *    violation observée est forcément la nôtre. C’est l’instrument de la liste
 *    de 04-Architecture/hebergement.md §La pose chez un hôte.
 *
 * ⚠️ ET SUR UN AUTRE PORT QUE FEEDYS, comme `/` : c’est le seul montage qui
 *    ressemble à la réalité — deux origines, donc `script-src` et `connect-src`
 *    qui doivent nommer Feedys, là où une page servie par Feedys s’en tirerait
 *    avec `'self'`.
 *
 * ⛔ EN EN-TÊTE, pas en `<meta>` : c’est ainsi qu’un vrai hôte pose sa politique,
 *    et le `<meta>` ignore silencieusement certaines directives.
 */
function servirLaPageNue(reponse: ServerResponse, parametres: URLSearchParams): void {
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Un hôte sous CSP</title>
</head>
<body>
<h1>Une page d’hôte sans un seul style ni script EN LIGNE</h1>
<p>Tout ce que la console dit ici vient de Feedys.</p>
<script src="/csp-identite.js"></script>
<script src="${FEEDYS}/widget.js" data-cle="${choisirCle(parametres.get('cle'))}" defer></script>
</body>
</html>
`

  reponse.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'content-security-policy': choisirPolitique(parametres.get('politique')),
  })
  reponse.end(html)
}

/**
 * L’identité, posée par un FICHIER de l’hôte et non par un script en ligne —
 * sinon la page ne pourrait pas être servie sans `script-src 'unsafe-inline'`,
 * et on mesurerait le CSP de la page de recette au lieu de celui de Feedys.
 *
 * ⚠️ ELLE EST POSÉE EN FONCTION, exprès : c’est la forme recommandée dès qu’une
 *    page peut rester ouverte longtemps (01-Specs/widget.md §L’intégration), et
 *    c’est la seule façon de la voir tourner dans un vrai navigateur.
 *
 * ⛔ Le jeton est INVENTÉ et ne signe rien. Le serveur le refusera, ce qui est
 *    le comportement attendu : le retour est accepté sans auteur. Le dépôt est
 *    public — aucun vrai jeton n’entre ici.
 */
function servirLIdentite(reponse: ServerResponse): void {
  reponse.writeHead(200, {
    'content-type': 'text/javascript; charset=utf-8',
    'cache-control': 'no-store',
  })
  reponse.end(`window.feedys = { identite: () => 'jeton-de-demonstration' }
`)
}

/**
 * ⚠️ La politique traverse la barre d’adresse : on la borne à ce qu’une
 *    directive CSP peut contenir. Ce serveur ne sert qu’en développement, mais
 *    une page de recette qui recopie n’importe quoi dans un en-tête finit par
 *    apprendre à quelqu’un que c’est normal — même remarque que `choisirCle`.
 */
const FORME_POLITIQUE = /^[A-Za-z0-9 :/.'*;,_-]{1,400}$/

/** La politique mesurée — hebergement.md §La pose chez un hôte. */
const POLITIQUE_PAR_DEFAUT = `default-src 'none'; script-src 'self' ${FEEDYS}; connect-src ${FEEDYS}`

function choisirPolitique(demandee: string | null): string {
  const candidate = demandee?.trim() ?? ''
  return FORME_POLITIQUE.test(candidate) ? candidate : POLITIQUE_PAR_DEFAUT
}

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
