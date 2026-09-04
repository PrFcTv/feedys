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

## Comment elle est produite

⛔ **Une fois, à la fin de l’entretien**, par le port `aval` de
`domaine/entretien/tour.ts` §`terminerEntretien` — appelé **après** la clôture, et dont l’échec est
avalé. Les trois chemins de [entretien.md](entretien.md) y mènent :

| Fin | Statut du retour | Ce qu’en sait le modèle |
|---|---|---|
| envoi manuel | `envoye` | « la personne a envoyé quand elle a jugé que c’était dit » |
| deux relances atteintes | `envoye` | « l’entretien s’est arrêté sur la limite, pas parce qu’il était complet » |
| abandon | `abandonne` | « la personne a refermé le panneau ; rien n’est confirmé » |

⛔ **Une synthèse qui rate ne perd rien.** Le retour est en base depuis l’ingestion et clos depuis
la fin d’entretien ; il lui manque sa note, c’est tout, et la note est rejouable.

### Le schéma est UNE définition

Le même objet zod — `domaine/synthese/schema.ts` — est passé à `generateObject`, **qui en fait le
JSON Schema envoyé au modèle**, et sert à relire ce qu’on a stocké. Deux définitions du même objet
divergent toujours, et la divergence se découvre le jour où une note arrive tronquée.

⛔ Il est `.strict()`, ce qui rend l’interdit **vérifiable** : `priorite`, `severite`, `score`,
`cause_probable` sont refusés, pas ignorés.

### ⛔ Le verbatim tient par construction, pas par docilité

Le prompt demande au modèle de citer mot pour mot. **Ce n’est pas suffisant, et on ne s’en
contente pas** : `domaine/synthese/verbatim.ts` **remplace** chaque citation par la tranche exacte
du message d’origine, et **jette** celles qu’il ne retrouve pas.

⚠️ La recherche tolère les blancs et la casse — un modèle recopie fidèlement mais re-ponctue et
met une majuscule au premier mot — mais **ce qu’on garde est toujours découpé dans le texte
d’origine**. La propriété « la citation est une sous-chaîne exacte » est donc vraie par
construction, et le test qui la vérifie teste notre code, pas la docilité d’un modèle.

⚠️ Une citation jetée est **journalisée** : c’est le signal qu’un prompt dérive vers la
reformulation, et on veut le voir avant les utilisateurs.

### Ce que le serveur ne laisse pas décider au modèle

`confiance` est plafonnée à `basse` dans deux cas, parce qu’ils ne se lisent pas dans le fil
([D-014](../00-Projet/DECISIONS_LOG.md)) :

- **la personne est partie en cours d’entretien** — le fil s’arrête, mais rien n’y dit que c’est
  un abandon ;
- **aucune citation n’a survécu à la vérification** — si on n’a pas réussi à citer la personne,
  on ne prétend pas l’avoir bien comprise.

Le reste — transcript pauvre, reformulation non confirmée — est demandé au prompt, parce que ça se
lit dans le fil et que le modèle le lit mieux qu’une règle.

### Ce qui est écrit

| Colonne | Contenu |
|---|---|
| `contenu` | l’objet entier, en `jsonb` |
| `confiance` | **extraite en colonne typée**, en plus du jsonb — c’est dessus qu’on filtre |
| `modele` | l’identifiant que le fournisseur dit avoir utilisé, pas celui qu’on a demandé |
| `jetons_entree`, `jetons_sortie` | nullables : un fournisseur muet sur sa consommation ne fait pas échouer la note |

Dans la même transaction, `type`, `titre` et `zone` sont recopiés sur le **retour**. ⛔ Ce sont des
**étiquettes**, corrigeables à la main ; ni le résumé, ni les citations, ni le fil ne le sont.

### La mise au point du prompt

```bash
pnpm entretien:rejouer -- --retour <id> --synthese [--prompt] [--modele <id>]
```

La note est rendue telle que le développeur la lirait, **citations passées par la vérification
verbatim** — les citations jetées sont affichées comme telles. C’est là qu’on voit un prompt qui
dérive.

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
