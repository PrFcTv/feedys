/**
 * `pnpm entretien:rejouer -- --retour <id>`
 *
 * Rejoue la boucle d’entretien sur un retour existant, sans widget et sans
 * navigateur. **C’est l’outil de mise au point du prompt** : on change
 * `domaine/entretien/prompts/systeme.md`, on rejoue sur dix vrais retours, on
 * compare ce que le bot aurait demandé avec ce qu’il avait demandé.
 *
 * ⛔ IL N’ÉCRIT RIEN. Ni message, ni statut, ni synthèse. Un outil de mise au
 *    point qui modifie ce qu’il mesure ne mesure plus rien — et le fil d’un
 *    retour ne se réécrit jamais (04-Architecture/conventions-db.md).
 *
 * ⚠️ Il rejoue CHAQUE point de décision : à chaque endroit où le bot a parlé, il
 *    montre ce qui avait été demandé et ce que le prompt d’aujourd’hui
 *    demanderait. C’est la comparaison qui a de la valeur, pas la dernière
 *    réponse seule.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client } from 'pg'

import type { TourEntretien } from '../domaine/entretien/modele'
import { modeleClaude } from '../domaine/entretien/modele'
import type { ContexteEntretien, TourFil } from '../domaine/entretien/prompts'
import { assemblerSyntheseSysteme, assemblerSysteme } from '../domaine/entretien/prompts'
import { MAX_RELANCES, relancesPosees } from '../domaine/entretien/tour'
import { finDe, parolesDe } from '../domaine/synthese/produire'
import type { Synthese } from '../domaine/synthese/schema'
import { verifierCitations } from '../domaine/synthese/verbatim'
import { identifiantModele } from '../infra/composition'
import { lireGabaritSynthese, lireGabaritSysteme } from '../infra/prompts'

import { lireArgumentsRejouer } from './arguments'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

try {
  process.loadEnvFile(path.join(RACINE, '.env.local'))
} catch {
  // Pas de .env.local ici — les variables viennent de l’environnement.
}

const RETOUR = `
  select r.id, r.statut, r.source, r.auteur_nom, r.auteur_role, r.cree_le,
         c.url, c.titre_page, c.ecran, c.selecteur_dom,
         c.navigateur, c.systeme, c.viewport_l, c.viewport_h, c.fuseau
    from retours r
    left join contextes c on c.retour_id = r.id
   where r.id = $1
   limit 1
`

const FIL = `
  select role, texte, motif
    from messages
   where retour_id = $1
   order by ordre asc
`

interface LigneFil extends TourFil {
  readonly motif: string | null
}

function ouNul(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.trim() !== '' ? valeur : null
}

function entierOuNul(valeur: unknown): number | null {
  return typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : null
}

/**
 * Les points de décision : chaque endroit où le bot a parlé, plus la fin.
 *
 * ⚠️ La fin est incluse même quand le bot y a déjà parlé : c’est là qu’on voit
 *    si le prompt sait s’arrêter, ce qui est la moitié de son travail.
 */
function pointsDeDecision(fil: readonly LigneFil[]): number[] {
  const points = fil.flatMap((tour, index) => (tour.role === 'bot' ? [index] : []))
  if (points[points.length - 1] !== fil.length) points.push(fil.length)
  return points
}

function rendre(tour: TourEntretien): string {
  const { comprehension } = tour
  const lignes = [
    `    type        ${comprehension.type}`,
    `    titre       ${comprehension.titre}`,
    `    résumé      ${comprehension.resume}`,
  ]

  if (comprehension.ecran) lignes.push(`    écran       ${comprehension.ecran}`)
  if (comprehension.recurrence) lignes.push(`    récurrence  ${comprehension.recurrence}`)

  lignes.push('')
  lignes.push(`    question    ${tour.question ?? '— (le bot s’arrête)'}`)
  // ⛔ Le motif n’est jamais montré au collaborateur. Ici, il est TOUT l’intérêt :
  //    quand une question est mauvaise, c’est lui qui dit pourquoi.
  lignes.push(`    motif       ${tour.motif}`)

  return lignes.join('\n')
}

/**
 * La note, telle qu’elle serait écrite.
 *
 * ⚠️ Les citations sont passées par la vérification verbatim, comme en
 *    production : c’est LÀ qu’on voit un prompt qui dérive vers la
 *    reformulation, et c’est la seule façon de le voir avant les utilisateurs.
 */
function rendreSynthese(synthese: Synthese, paroles: readonly string[]): string {
  const { gardees, jetees } = verifierCitations(synthese.citations, paroles)

  const lignes = [
    `    ${synthese.type.toUpperCase()} · ${synthese.impact} · confiance ${synthese.confiance}`,
    `    ${synthese.zone}`,
    '',
    `    ${synthese.titre}`,
    `    ${synthese.resume}`,
  ]

  if (synthese.attendu) lignes.push(`      Attendu    ${synthese.attendu}`)
  if (synthese.constate) lignes.push(`      Constaté   ${synthese.constate}`)
  if (synthese.recurrence) lignes.push(`      Récurrence ${synthese.recurrence}`)
  if (synthese.besoin) lignes.push(`      Besoin     ${synthese.besoin}`)
  if (synthese.frequence) lignes.push(`      Fréquence  ${synthese.frequence}`)

  lignes.push('', '    CE QU’ELLE A DIT')
  for (const citation of gardees) lignes.push(`      « ${citation} »`)
  if (gardees.length === 0) lignes.push('      (aucune citation n’a survécu à la vérification)')

  // ⛔ Le signal qui compte pour la mise au point : le modèle a reformulé.
  for (const citation of jetees) lignes.push(`      ⛔ JETÉE (non verbatim) — « ${citation} »`)

  lignes.push('', '    CE QU’ON NE SAIT PAS')
  for (const question of synthese.questions_ouvertes) lignes.push(`      · ${question}`)
  if (synthese.questions_ouvertes.length === 0) {
    lignes.push('      (rien — l’entretien a suffi, d’après le modèle)')
  }

  return lignes.join('\n')
}

async function principal(): Promise<void> {
  const options = lireArgumentsRejouer(process.argv.slice(2))

  const url = process.env['DATABASE_URL']
  if (!url) {
    throw new Error(
      'DATABASE_URL est absente. Elle vit dans .env.local sur le poste, ' +
        'et dans l’environnement du conteneur en production.',
    )
  }

  const client = new Client({ connectionString: url })
  await client.connect()

  let contexte: ContexteEntretien
  let fil: LigneFil[]
  let entete: string
  let statut: string

  try {
    const { rows } = await client.query(RETOUR, [options.retour])
    const ligne = rows[0]
    if (ligne === undefined) throw new Error(`Aucun retour « ${options.retour} ».`)

    const recuLe = ligne['cree_le']
    contexte = {
      url: ouNul(ligne['url']),
      titrePage: ouNul(ligne['titre_page']),
      ecran: ouNul(ligne['ecran']),
      selecteurDom: ouNul(ligne['selecteur_dom']),
      navigateur: ouNul(ligne['navigateur']),
      systeme: ouNul(ligne['systeme']),
      viewportL: entierOuNul(ligne['viewport_l']),
      viewportH: entierOuNul(ligne['viewport_h']),
      fuseau: ouNul(ligne['fuseau']),
      auteurNom: ouNul(ligne['auteur_nom']),
      auteurRole: ouNul(ligne['auteur_role']),
      recuLe: recuLe instanceof Date ? recuLe.toISOString() : ouNul(recuLe),
    }

    statut = String(ligne['statut'])
    entete = `${String(ligne['id'])} · ${statut} · ${String(ligne['source'])}`

    const messages = await client.query(FIL, [options.retour])
    fil = messages.rows.map((tour) => ({
      role: tour['role'] === 'bot' ? ('bot' as const) : ('collaborateur' as const),
      texte: String(tour['texte'] ?? ''),
      motif: ouNul(tour['motif']),
    }))
  } finally {
    await client.end()
  }

  // ⚠️ `--modele` sert exactement à ça : comparer deux modèles sur le même
  //    retour, sans toucher à l’environnement.
  const modele = modeleClaude({
    gabarit: lireGabaritSysteme(),
    gabaritSynthese: lireGabaritSynthese(),
    identifiant: options.modele ?? identifiantModele(),
  })

  console.log(`\nRetour ${entete}`)
  console.log(`Modèle ${modele.identifiant}\n`)

  // ⚠️ `--synthese` rejoue LE LIVRABLE. C’est un autre prompt, une autre mise au
  //    point, et le fil entier plutôt que ses points de décision.
  if (options.synthese) {
    const fin = finDe(statut, relancesPosees(fil), MAX_RELANCES)
    const demande = { contexte, fil, fin }

    console.log('─'.repeat(72))
    console.log(`Fin de l’entretien · ${fin}`)

    if (options.prompt) {
      console.log('\n  PROMPT SYSTÈME ASSEMBLÉ')
      console.log(
        assemblerSyntheseSysteme(lireGabaritSynthese(), demande)
          .split('\n')
          .map((ligne) => `    │ ${ligne}`)
          .join('\n'),
      )
    }

    console.log('\n  LA NOTE QUE LE DÉVELOPPEUR LIRAIT\n')
    try {
      const rendu = await modele.synthese(demande)
      console.log(rendreSynthese(rendu.synthese, parolesDe(fil)))
      console.log(
        `\n    modèle ${rendu.modele} · ${rendu.jetonsEntree ?? '?'} jetons en entrée, ` +
          `${rendu.jetonsSortie ?? '?'} en sortie`,
      )
    } catch (erreur) {
      console.log(`    ⛔ ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    }

    console.log('')
    return
  }

  for (const point of pointsDeDecision(fil)) {
    const prefixe = fil.slice(0, point)
    const restantes = Math.max(0, MAX_RELANCES - relancesPosees(prefixe))
    const demande = { contexte, fil: prefixe, relancesRestantes: restantes }

    console.log('─'.repeat(72))
    console.log(`Point ${point} · ${restantes} relance(s) restante(s)`)

    for (const tour of prefixe) {
      const qui = tour.role === 'bot' ? 'bot ' : 'coll'
      console.log(`  ${qui} │ ${tour.texte.replace(/\s+/g, ' ').slice(0, 120)}`)
    }

    const attendu = fil[point]
    if (attendu?.role === 'bot') {
      console.log('\n  CE QUI AVAIT ÉTÉ DEMANDÉ')
      console.log(`    question    ${attendu.texte}`)
      console.log(`    motif       ${attendu.motif ?? '—'}`)
    }

    if (options.prompt) {
      console.log('\n  PROMPT SYSTÈME ASSEMBLÉ')
      console.log(
        assemblerSysteme(lireGabaritSysteme(), demande)
          .split('\n')
          .map((ligne) => `    │ ${ligne}`)
          .join('\n'),
      )
    }

    console.log('\n  CE QUE LE PROMPT D’AUJOURD’HUI REND')
    try {
      console.log(rendre(await modele.tour(demande)))
    } catch (erreur) {
      console.log(`    ⛔ ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    }

    console.log('')
  }
}

principal().catch((erreur: unknown) => {
  process.exitCode = 1
  console.error(erreur instanceof Error ? `\n⛔ ${erreur.message}\n` : erreur)
})
