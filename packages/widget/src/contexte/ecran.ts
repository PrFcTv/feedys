/**
 * L’écran déduit.
 *
 * ⚠️ Il ne remplace pas l’URL, qui est jointe entière : il sert à ce que le
 *    développeur lise « dossiers » plutôt que
 *    `/dossiers/clx7f2/edition?onglet=3`, et à ce que la carte de compréhension
 *    ait quelque chose de court à montrer (01-Specs/widget.md §En entretien).
 *
 * ⛔ Aucune requête, aucun DOM, aucune heuristique sur le contenu de la page :
 *    seulement le chemin de l’URL.
 */
import { BORNES } from '../transport'

/** Le séparateur entre deux niveaux. Une chevron fine, pas un `/` de plus. */
const SEPARATEUR = ' › '

/** Au-delà, le nom d’écran cesse d’être un nom d’écran. */
const PROFONDEUR_MAX = 3

const ACCUEIL = 'accueil'

/**
 * Les segments qui désignent une ligne plutôt qu’un écran.
 *
 * ⚠️ On les jette : `/dossiers/clx7f2/edition` et `/dossiers/k9m3p1/edition`
 *    sont le même écran, et les compter comme deux rendrait le champ inutile.
 */
const IDENTIFIANTS: readonly RegExp[] = [
  /^\d+$/,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  /^[0-9A-HJKMNP-TV-Z]{26}$/,
  /^[0-9a-f]{12,}$/i,
  /^[a-z0-9]{20,}$/i,
]

function estIdentifiant(segment: string): boolean {
  return IDENTIFIANTS.some((forme) => forme.test(segment))
}

/**
 * ⚠️ Rend `undefined` plutôt qu’une chaîne vide quand rien n’est déductible :
 *    la colonne est nullable, et une chaîne vide se lit comme un écran qui
 *    s’appellerait « ».
 */
export function deduireEcran(url: string): string | undefined {
  let chemin: string

  try {
    chemin = new URL(url).pathname
  } catch {
    return undefined
  }

  const segments = chemin
    .split('/')
    .map((s) => decodeSegment(s).trim())
    .filter((s) => s !== '' && !estIdentifiant(s))
    .slice(0, PROFONDEUR_MAX)

  if (segments.length === 0) return ACCUEIL

  return segments.join(SEPARATEUR).slice(0, BORNES.ecran)
}

/** Un `%20` dans un chemin n’a pas à ressortir tel quel dans un nom d’écran. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
