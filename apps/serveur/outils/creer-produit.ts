/**
 * `pnpm produit:creer -- --nom "VictorIA" --domaine victoria.exemple.fr`
 *
 * Crée un produit et imprime sa clé publique et son secret. ⛔ UNE fois : le
 * secret n’est stocké qu’en argon2, et rien ne peut le réafficher ensuite.
 *
 * ⚠️ Un outil de ligne de commande et pas un écran : le MVP a un développeur et
 *    quatre produits (00-Projet/ROADMAP.md §hors MVP).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client } from 'pg'

import { clePublique, identifiant, secretProduit } from '../infra/identifiants'
import { chiffrer, cleDeChiffrement, hacherSecret, nouvelleCleDeChiffrement } from '../infra/secret'

import { lireArgumentsProduit } from './arguments'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

try {
  process.loadEnvFile(path.join(RACINE, '.env.local'))
} catch {
  // Pas de .env.local ici — les variables viennent de l’environnement.
}

const ECRIRE = `
  insert into produits (id, nom, domaine, cle_publique, secret_hash, secret_chiffre)
  values ($1, $2, $3, $4, $5, $6)
`

async function principal(): Promise<void> {
  const { nom, domaine } = lireArgumentsProduit(process.argv.slice(2))

  const url = process.env['DATABASE_URL']
  if (!url) {
    throw new Error(
      'DATABASE_URL est absente. Elle vit dans .env.local sur le poste, ' +
        'et dans l’environnement du conteneur en production.',
    )
  }

  // ⛔ Sans clé de chiffrement, le produit ne pourrait JAMAIS vérifier une
  //    identité — et rien ne le dirait ensuite : ses retours arriveraient
  //    simplement tous en `identite_verifiee = false`. On refuse maintenant,
  //    bruyamment, plutôt que de créer un produit à moitié (P-012, D-015).
  const clef = cleDeChiffrement()
  if (clef === null) {
    throw new Error(
      `FEEDYS_CLE_CHIFFREMENT est absente ou mal formée — 32 octets en base64url
   sont attendus. Sans elle, ce produit ne pourrait jamais vérifier l’identité
   signée par son hôte (D-015).

   Une clé neuve   ${nouvelleCleDeChiffrement()}

   ⛔ À ranger dans .env.local, jamais dans le dépôt.`,
    )
  }

  const cle = clePublique()
  const secret = secretProduit()

  const client = new Client({ connectionString: url })
  await client.connect()

  try {
    await client.query(ECRIRE, [
      identifiant(),
      nom,
      domaine,
      cle,
      await hacherSecret(secret),
      chiffrer(secret, clef),
    ])
  } finally {
    await client.end()
  }

  const publique = process.env['FEEDYS_URL_PUBLIQUE'] ?? 'https://feedys.exemple.fr'

  console.log(`
Produit créé · ${nom} — ${domaine}

  Clé publique   ${cle}
  Secret         ${secret}

À coller dans le logiciel hôte :

  <script src="${publique}/widget.js" data-cle="${cle}" defer></script>

⛔ Le secret ne sera plus jamais affiché. Il vit sur le SERVEUR de l’hôte, qui
   s’en sert pour signer l’identité du collaborateur — jamais dans le
   navigateur, jamais dans une page. Comment signer : README §Attacher une
   identité.
`)
}

principal().catch((erreur: unknown) => {
  process.exitCode = 1
  console.error(erreur instanceof Error ? `\n⛔ ${erreur.message}\n` : erreur)
})
