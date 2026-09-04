/**
 * Les dates du back-office, en français.
 *
 * ⛔ Module pur : le « maintenant » est passé, jamais lu. C’est ce qui rend
 *    « il y a 3 h » testable sans figer une horloge (architecture.md §3).
 *
 * ⚠️ La liste montre un ÂGE — « il y a 20 min » —, la fiche une DATE COMPLÈTE.
 *    Sur une liste, ce qui compte est « est-ce récent » ; sur une fiche, c’est
 *    « quand exactement », parce qu’on va la rapprocher d’un journal.
 */
const MINUTE = 60_000
const HEURE = 60 * MINUTE
const JOUR = 24 * HEURE

export function age(quand: Date, maintenant: number): string {
  const ecart = Math.max(0, maintenant - quand.getTime())

  if (ecart < MINUTE) return 'à l’instant'
  if (ecart < HEURE) return `il y a ${Math.floor(ecart / MINUTE)} min`
  if (ecart < JOUR) return `il y a ${Math.floor(ecart / HEURE)} h`

  const jours = Math.floor(ecart / JOUR)
  return jours === 1 ? 'hier' : `il y a ${jours} jours`
}

/** ⚠️ Le fuseau du collaborateur quand on le connaît : l’heure qu’il était POUR ELLE. */
export function dateComplete(quand: Date, fuseau?: string | null): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: fuseau?.trim() || 'UTC',
    }).format(quand)
  } catch {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(quand)
  }
}
