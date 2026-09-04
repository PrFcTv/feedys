#!/usr/bin/env node

/**
 * Le serveur MCP — il expose les retours à l’agent de code du développeur.
 *
 * ⛔ **Ce paquet est MIT.** Rien de Quackback (AGPL) n’y entre malgré le sujet
 *    commun : on n’en reprend que la forme des outils et le nommage. Une API
 *    n’est pas du code (04-Architecture/licences.md).
 *
 * ⛔ Il n’importe rien de `apps/serveur`, et le lint le vérifie. Il parle au
 *    serveur Feedys en HTTP — deux processus qui dialoguent ne forment pas un
 *    seul programme.
 *
 * ⚠️ Transport `stdio` : c’est ce que Claude Code lance. Le serveur MCP tourne
 *    sur le POSTE du développeur ; c’est le serveur Feedys, lui, qui est distant.
 *
 * Installation : voir le README de ce paquet.
 */
import { pathToFileURL } from 'node:url'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { creerClient } from './client.js'
import { poserLesOutils } from './outils.js'

export const VERSION = '0.1.0'

export { creerClient, ErreurFeedys } from './client.js'
export { poserLesOutils } from './outils.js'
export * from './contrat.js'

/**
 * ⛔ Les deux variables sont EXIGÉES. Un défaut implicite sur l’origine ferait
 *    parler le serveur MCP à `localhost` sans le dire, et un jeton vide ferait
 *    échouer chaque appel avec un 401 qu’on mettrait une heure à comprendre.
 */
export function reglagesDeLEnvironnement(env: NodeJS.ProcessEnv = process.env) {
  const origine = env['FEEDYS_URL']?.trim()
  const jeton = env['FEEDYS_MCP_JETON']?.trim()

  if (!origine || !jeton) {
    throw new Error(
      'FEEDYS_URL et FEEDYS_MCP_JETON sont exigées. FEEDYS_URL est l’origine du serveur ' +
        'Feedys (https://feedys.exemple.fr) ; FEEDYS_MCP_JETON est le jeton posé sur ce ' +
        'serveur. Voir le README de @feedys/mcp.',
    )
  }

  return { origine, jeton }
}

export async function demarrer(): Promise<void> {
  const serveur = new McpServer({ name: 'feedys', version: VERSION })

  poserLesOutils(serveur, creerClient(reglagesDeLEnvironnement()))

  await serveur.connect(new StdioServerTransport())
}

/**
 * ⚠️ On ne démarre que si ce module est le point d’entrée : importé par un test,
 *    il ne doit ouvrir ni `stdio`, ni réseau.
 */
const lanceDirectement =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (lanceDirectement) {
  demarrer().catch((erreur: unknown) => {
    process.exitCode = 1
    // ⛔ stderr, jamais stdout : stdout porte le protocole MCP.
    console.error(erreur instanceof Error ? `⛔ ${erreur.message}` : erreur)
  })
}
