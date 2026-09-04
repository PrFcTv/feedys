# Spécification — la synthèse

La synthèse est **ce que le développeur lit**. C’est le livrable du produit : tout le reste — la
dictée, l’entretien, le contexte — n’existe que pour la fabriquer.

## Le principe

> Une note qu’on peut lire en trente secondes et agir dessus sans rouvrir la conversation.

Elle est produite **une fois**, à la fin de l’entretien, par un appel `generateObject` — donc
typée, pas du texte à reparser. Elle est stockée telle quelle et rendue en trois formes : email,
fiche du back-office, réponse MCP.

## La structure

```ts
type Synthese = {
  // ── ce que c’est ─────────────────────────────────────────
  type: 'bug' | 'idee' | 'question' | 'gene'
  titre: string              // une phrase, sans point final, ≤ 80 caractères
  resume: string             // 2 à 4 phrases, à la 3e personne

  // ── pour un bug ──────────────────────────────────────────
  attendu?: string           // ce que la personne pensait obtenir
  constate?: string          // ce qu’elle a obtenu
  recurrence?: 'premiere_fois' | 'deja_vu' | 'systematique'

  // ── pour une idée ────────────────────────────────────────
  besoin?: string            // le problème derrière la solution proposée
  frequence?: string         // à quelle fréquence le besoin se présente

  // ── dans tous les cas ────────────────────────────────────
  zone: string               // la partie du logiciel concernée, déduite du contexte
  impact: 'bloque' | 'ralentit' | 'agace' | 'indetermine'

  citations: string[]        // 1 à 3 extraits VERBATIM, jamais reformulés
  confiance: 'haute' | 'moyenne' | 'basse'
  questions_ouvertes: string[]   // ce que l’entretien n’a pas établi
}
```

## Les trois champs qui font la différence

Le reste est du résumé ordinaire. Ces trois-là sont la raison d’être du format.

### `citations` — les mots exacts

**1 à 3 extraits verbatim du collaborateur, jamais reformulés, jamais nettoyés.**

Un résumé lessive l’émotion, et l’émotion est de l’information. « c’est pénible » et « je perds
dix minutes tous les matins là-dessus » se résument tous les deux en « friction sur le tri » —
mais ils ne se priorisent pas pareil.

⛔ **On ne corrige ni la syntaxe, ni les hésitations, ni les fautes de transcription.** La citation
est une pièce, pas une phrase.

### `confiance` — ce que le modèle sait de son propre travail

`basse` quand le transcript était pauvre, quand l’entretien s’est arrêté sur la limite de deux
relances, ou quand la reformulation n’a pas été confirmée par le collaborateur.

Une note en confiance basse **se lit différemment** : on ne planifie pas dessus, on va voir la
personne.

### `questions_ouvertes` — les trous, déclarés

C’est la contrepartie de la limite à deux relances ([D-006](../00-Projet/DECISIONS_LOG.md)). Le
bot s’arrête tôt, **donc il doit dire ce qu’il n’a pas obtenu.**

> `["Est-ce que ça se produit aussi sur les autres listes ?", "Depuis quelle version — la personne
> ne sait pas dire"]`

⚠️ **Une liste vide est un signal, pas un défaut** : elle veut dire que l’entretien a suffi. Si
elle est vide dans 90 % des cas, c’est le prompt qui ment ; si elle a six entrées, c’est
l’entretien qui a échoué.

## Le rendu par email

Sujet :

```
[Feedys · VictorIA] Le tri par date de la liste des dossiers se réinitialise
```

Corps — en texte lisible, pas en tableau de bord. Ordre imposé : **ce que c’est, ce qu’a dit la
personne, ce qui manque, le contexte technique**. Le contexte va en dernier parce qu’on ne le lit
qu’en cas de besoin.

```
BUG · ralentit · confiance moyenne
Liste des dossiers

Le tri par date se réinitialise au retour sur la page. La personne doit le
reposer à chaque navigation. Comportement présent depuis toujours d’après elle.

  Attendu   le tri reste en place au retour
  Constaté  le tri revient à l’ordre par défaut
  Récurrence  systématique

CE QU’ELLE A DIT
  « dès que je reviens en arrière il se remet à zéro »
  « faut que je le refasse à chaque fois c’est pénible »

CE QU’ON NE SAIT PAS
  · Est-ce que ça touche aussi les autres listes ?

CONTEXTE
  Marie Dupont (gestionnaire) · 4 sept. 2026 à 09:14
  /dossiers?tri=date · Chrome 141 · 1512 × 982
  → ouvrir la fiche : https://feedys.exemple.fr/r/clx8f2a...
```

⛔ **Pas de HTML riche, pas de logo, pas de bouton.** Un email de Feedys est un mémo, et il doit
rester lisible dans n’importe quel client, y compris en texte brut.

## Le rendu MCP

Le serveur MCP ([packages/mcp]) expose la même synthèse, sous une forme faite pour être lue par un
agent de code :

| Outil | Ce qu’il rend |
|---|---|
| `lister_retours` | les retours filtrés par statut, type, zone, date |
| `lire_retour` | la synthèse complète, plus le fil brut de l’entretien |
| `marquer_retour` | change le statut : `lu`, `traite`, `ecarte` |

⚠️ **`lire_retour` rend aussi le fil brut**, pas seulement la synthèse. Quand un agent creuse
réellement un problème, la parole d’origine contient souvent ce que le résumé a perdu.

⛔ **Aucun outil MCP ne modifie ni ne supprime le contenu d’un retour.** Le statut est la seule
chose qu’on peut changer. Ce que quelqu’un a dit ne se réécrit pas.

## Le rendu dans le back-office

La fiche montre, dans cet ordre : la synthèse, puis le fil de l’entretien tel qu’il s’est déroulé,
puis le contexte technique et la capture.

Deux exigences :

- **le fil brut est toujours accessible**, jamais replié derrière un « voir les détails ». C’est
  la source ; la synthèse n’en est qu’une lecture ;
- **on peut corriger le `type` et la `zone` à la main.** Le modèle se trompe, et une note mal
  classée est une note perdue. ⛔ En revanche, ni le résumé, ni les citations, ni le fil ne sont
  modifiables.

## Ce que la synthèse ne contient pas

- **Aucune priorité, aucune sévérité, aucun score.** Arbitrer est le travail du développeur, et
  un modèle qui note à sa place fabrique une fausse objectivité qu’on finit par suivre.
- **Aucune suggestion technique.** Ni cause probable, ni fichier suspect, ni correctif proposé.
  L’agent de code fera ça bien mieux, avec le dépôt sous les yeux.
- **Aucun rapprochement avec d’autres retours.** Le regroupement est hors MVP ([ROADMAP.md]), et
  le suggérer trop tôt produirait des faux liens que personne ne vérifierait.
