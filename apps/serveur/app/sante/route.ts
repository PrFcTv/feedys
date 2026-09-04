/**
 * `GET /sante` — la base répond, et les migrations sont à jour.
 *
 * ⛔ Deux questions, pas trois. Une sonde qui interroge le modèle ou le relais
 *    SMTP ferait redémarrer le conteneur parce qu’Anthropic a éternué, et
 *    perdrait des retours pour protéger un confort. Ce qui tue Feedys, c’est une
 *    base injoignable ou un schéma qui a divergé — le reste se dégrade sans
 *    perdre la parole de personne (01-Specs/ingestion.md §L’invariant).
 *
 * ⛔ Du routage, et rien d’autre. La lecture est dans `infra/base/migrations.ts`,
 *    la décision dans `domaine/demarrage/controles.ts`.
 *
 * ⚠️ `no-store` : une sonde qui lit un cache ne sonde rien.
 */
import { dossierMigrations } from '../../infra/demarrage'
import { pool } from '../../infra/base/connexion'
import { lireMigrations, planifier } from '../../infra/base/migrations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REGISTRE = 'select nom, sha256 from migrations order by nom'

type Etat = 'ok' | 'degrade'

interface Sante {
  readonly etat: Etat
  readonly base: 'ok' | 'injoignable'
  readonly migrations: 'a_jour' | 'en_attente' | 'divergence' | 'inconnu'
  readonly version: string
  readonly detail?: string
}

export async function GET(): Promise<Response> {
  const sante = await etatDuService()

  return new Response(JSON.stringify(sante), {
    // ⚠️ 503 et non 500 : un proxy sait le lire comme « pas maintenant », et
    //    c’est ce que ça veut dire.
    status: sante.etat === 'ok' ? 200 : 503,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

async function etatDuService(): Promise<Sante> {
  // ⚠️ Absente sur un poste, où « dev » est la réponse honnête
  //    (04-Architecture/hebergement.md §Les variables).
  const version = process.env['FEEDYS_VERSION']?.trim() || 'dev'

  let connexion
  try {
    connexion = await pool().connect()
  } catch {
    // ⛔ Rien de DATABASE_URL ne sort d’ici : elle porte un mot de passe.
    return { etat: 'degrade', base: 'injoignable', migrations: 'inconnu', version }
  }

  try {
    const dossier = dossierMigrations()
    if (dossier === undefined) {
      return {
        etat: 'degrade',
        base: 'ok',
        migrations: 'inconnu',
        version,
        detail: 'le dossier des migrations est introuvable',
      }
    }

    const { rows } = await connexion.query(REGISTRE)
    const registre = rows.map((r) => ({ nom: String(r['nom']), sha256: String(r['sha256']) }))
    const enAttente = planifier(await lireMigrations(dossier), registre)

    if (enAttente.length > 0) {
      return {
        etat: 'degrade',
        base: 'ok',
        migrations: 'en_attente',
        version,
        detail: `${enAttente.length} migration(s) non appliquée(s)`,
      }
    }

    return { etat: 'ok', base: 'ok', migrations: 'a_jour', version }
  } catch (erreur) {
    // ⚠️ `planifier` lève `DivergenceError` — la base et le dépôt ne racontent
    //    plus la même histoire. Son message est fait pour être lu.
    return {
      etat: 'degrade',
      base: 'ok',
      migrations: 'divergence',
      version,
      detail: erreur instanceof Error ? erreur.message : 'lecture du registre impossible',
    }
  } finally {
    connexion.release()
  }
}
