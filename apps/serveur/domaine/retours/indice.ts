/**
 * Le lien vers l’outil d’observabilité de l’hôte — une référence nue n’est
 * cliquable nulle part.
 *
 * ⛔ MÊME DOCTRINE QUE `correctif.ts`, ET CE N’EST PAS UNE ANALOGIE : c’est le
 *    même motif, délibérément réemployé. **Feedys n’appelle JAMAIS l’outil de
 *    l’hôte.** Il compose une URL et s’arrête là. Aller demander à Sentry si cet
 *    événement existe ferait entrer dans le serveur un jeton d’API, une
 *    dépendance réseau et un périmètre qui n’est pas le sien — exactement ce que
 *    [D-024](../../../../00-Projet/DECISIONS_LOG.md) refuse pour la forge.
 *
 * ⚠️ C’est aussi ce qui rend la corrélation SUPÉRIEURE à la recopie. Ce que le
 *    développeur veut d’une exception, c’est la pile démappée, la version et le
 *    contexte serveur — tout cela existe déjà chez lui. Une référence de
 *    quarante caractères l’y emmène ; recopier l’erreur, non. Le champ le plus
 *    léger du relevé est le plus utile ([D-026]).
 *
 * ⛔ Module pur : ni base, ni réseau, ni horloge (architecture.md §3).
 */

/**
 * La marque remplacée par la référence dans le gabarit du produit.
 *
 * ⚠️ Un gabarit et non un préfixe, contrairement à `url_forge` : les outils
 *    d’observabilité ne s’accordent sur aucune forme d’URL. Sentry veut
 *    `/issues/?query=<ref>`, un agrégateur de journaux veut la référence dans
 *    une requête de recherche, Grafana la veut dans un paramètre. Un préfixe
 *    concaténé n’aurait marché que pour l’un d’eux.
 */
const MARQUE = '{{ref}}'

function propre(valeur: string | null | undefined): string | null {
  const net = valeur?.trim()
  return net === undefined || net === '' ? null : net
}

/**
 * L’URL cliquable d’un indice, ou `null` quand il n’y en a pas.
 *
 * ⛔ Rien d’autre que `https://` ne devient un lien. Une `url_observabilite`
 *    posée à la main pourrait porter n’importe quoi, et un `javascript:` rendu
 *    cliquable dans le back-office serait une faille ouverte par confort
 *    d’affichage — la même que `lienCorrectif` refuse.
 *
 * ⚠️ La référence est encodée : elle est opaque, elle vient du navigateur d’un
 *    hôte, et rien ne garantit qu’elle ne contient pas un `&` ou un `#` qui
 *    couperait l’URL en deux.
 */
export function lienIndice(urlObservabilite: string | null, reference: string | null): string | null {
  const ref = propre(reference)
  if (ref === null) return null

  // ⚠️ Une référence qui est DÉJÀ une URL est le lien : certains hôtes poussent
  //    directement le permalien de leur outil, et le recomposer le casserait.
  if (ref.startsWith('https://')) return ref

  const gabarit = propre(urlObservabilite)
  if (gabarit === null || !gabarit.startsWith('https://')) return null

  // ⛔ Sans marque, on ne devine pas où la mettre : un gabarit mal écrit donne
  //    un lien qui n’est PAS null mais qui n’emmène nulle part, et ce lien-là
  //    ment. Pas de marque, pas de lien — la référence reste lisible en clair.
  if (!gabarit.includes(MARQUE)) return null

  return gabarit.replaceAll(MARQUE, encodeURIComponent(ref))
}
