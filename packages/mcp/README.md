# `@feedys/mcp` — les retours, dans l’éditeur

Un serveur [MCP](https://modelcontextprotocol.io) qui expose les retours de Feedys à un agent de
code. C’est **le canal qui compte** : il met le retour là où le travail se fait, à côté du code
concerné ([D-007](../../00-Projet/DECISIONS_LOG.md)).

> Licence **MIT**, comme `packages/widget` — et pour la même raison
> ([04-Architecture/licences.md](../../04-Architecture/licences.md)). ⛔ Ce paquet n’importe **rien**
> de `apps/serveur`, qui est AGPL. Il lui parle en HTTP : deux processus qui dialoguent ne forment
> pas un seul programme.

## Les trois outils

| Outil | Ce qu’il rend | Écrit ? |
|---|---|---|
| `lister_retours` | les retours filtrés par statut, type, zone, date | non |
| `lire_retour` | la synthèse complète **et le fil brut de l’entretien** | non |
| `marquer_retour` | change le statut : `lu`, `traite`, `ecarte` | le statut, et **rien d’autre** |

⚠️ **`lire_retour` rend aussi le fil brut**, pas seulement la note. Quand un agent creuse
réellement un problème, la parole d’origine contient souvent ce que le résumé a perdu.

⛔ **Aucun outil ne modifie ni ne supprime le contenu d’un retour.** Ni le titre, ni le résumé, ni
les citations, ni un message. Ce que quelqu’un a dit ne se réécrit pas — ce n’est pas une
limitation technique, c’est le contrat du produit. Un retour qui ne mérite rien passe en `ecarte` ;
il n’est pas détruit.

## Installer dans Claude Code

Il faut **deux valeurs** :

| Variable | Ce que c’est |
|---|---|
| `FEEDYS_URL` | l’origine du serveur Feedys, par ex. `https://feedys.exemple.fr` |
| `FEEDYS_MCP_JETON` | le jeton posé sur ce serveur (variable `FEEDYS_MCP_JETON` côté serveur) |

⛔ **Le jeton est un secret.** Il ne va ni dans un dépôt, ni dans un `.mcp.json` versionné.
Utilisez la portée `local` (le défaut), qui range la configuration hors du dépôt.

```bash
# depuis la racine du dépôt Feedys
pnpm --filter @feedys/mcp build

claude mcp add feedys \
  --env FEEDYS_URL=https://feedys.exemple.fr \
  --env FEEDYS_MCP_JETON=… \
  -- node /chemin/absolu/vers/feedys/packages/mcp/dist/index.js
```

Puis, dans Claude Code :

```
/mcp
```

`feedys` doit apparaître **connecté**, avec ses trois outils.

### Vérifier que ça répond

```
Liste-moi les retours de type bug reçus depuis lundi.
```

## Ce qu’un agent en fait

Le cas d’usage qui justifie le paquet :

> « Lis le retour `clx8f2a…`, va voir le code de la zone concernée, et dis-moi ce qui pourrait
> produire ce comportement. »

L’agent lit la note **et le fil**, ouvre les fichiers, propose une piste. ⚠️ Le lien s’arrête là :
**c’est le développeur qui décide**, pas l’agent, et pas le modèle qui a écrit la note. Feedys
n’attribue aucune priorité et aucun score, précisément pour ne pas fabriquer une objectivité qu’on
finirait par suivre ([01-Specs/synthese.md](../../01-Specs/synthese.md)).

## Diagnostic

| Symptôme | Cause probable |
|---|---|
| `FEEDYS_URL et FEEDYS_MCP_JETON sont exigées` | une des deux variables manque dans la configuration MCP |
| `Ce jeton ne convient pas.` (401) | le jeton ne correspond pas à `FEEDYS_MCP_JETON` du serveur |
| `l’accès MCP est fermé…` (503) | le SERVEUR n’a pas de `FEEDYS_MCP_JETON`. ⚠️ Un serveur sans secret ne laisse pas passer : il ferme |
| `Ce retour n’existe pas.` (404) | l’identifiant est faux, ou le retour est sur une autre instance |

⚠️ Le serveur MCP écrit ses erreurs sur **stderr** : `stdout` porte le protocole, et une ligne de
trop y casse la session.
