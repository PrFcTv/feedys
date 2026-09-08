# Spécification — La traçabilité du correctif

## L’intention

Un retour marqué `traite` ne dit rien de ce qui l’a réparé. Six semaines plus tard, personne ne
sait quel commit a corrigé quoi, ni si quelque chose a été corrigé du tout : **« traité » est une
affirmation que rien ne vient étayer.**

Le manque se voit surtout du côté de l’agent de code. Il lit le retour par
[`lire_retour`](../packages/mcp/src/outils.ts), il écrit le correctif, il marque `traite` — et le
lien entre les trois n’existe nulle part. À la relecture suivante, il repart de zéro.

**Ce que fait cette spécification :** `marquer_retour` consigne, dans le même geste que le
marquage, **ce qui a corrigé le retour** — un SHA de commit, l’URL d’une PR, ou une phrase quand le
correctif n’est pas du code. Et `lire_retour` le rend, avec l’état du mot envoyé au collaborateur.

⛔ **Ce n’est pas un champ de plus, c’est une condition.** Marquer `traite` par MCP **exige** un
correctif. Sans lui, la traçabilité serait facultative, donc vide.

---

## 1. Deux publics, deux champs — l’invariant qui gouverne le reste

| Champ | S’adresse à | Exemple | Où il finit |
|---|---|---|---|
| `reponse` | **au collaborateur** | « Le tri garde son ordre maintenant. » | carte du widget ([retour-au-collaborateur.md](retour-au-collaborateur.md)) |
| `correctif.note` | **au développeur** | « reset du tri corrigé dans `useTableState` » | fiche du back-office et `lire_retour` |

⛔ **Les deux ne se recopient JAMAIS l’un dans l’autre.** Envoyer « corrigé dans `useTableState` »
à quelqu’un qui a dit « le tri se remet à zéro », c’est lui répondre dans une langue qui n’est pas
la sienne — exactement le guichet que Feedys refuse d’être
([VISION.md](../00-Projet/VISION.md)). Les deux voyagent dans le **même appel**, et c’est très
bien ; ils ne fusionnent pas.

---

## 2. Le contrat de `marquer_retour`

```ts
{
  id: string,
  statut: 'lu' | 'traite' | 'ecarte',
  reponse?: string,            // ≤ 500 car. — pour le collaborateur
  correctif?: {                // EXIGÉ pour `traite`
    ref?: string,              // SHA de 7 à 40 hex, ou URL https
    note?: string,             // ≤ 500 car. — pour le développeur
  },
}
```

### Les quatre refus

| Le geste | Ce que le serveur fait |
|---|---|
| `traite` **sans** `correctif` | ⛔ **refusé** — « traité » sans trace n’est qu’une affirmation |
| `correctif` **vide** (`{}`, deux espaces) | ⛔ **refusé** — une case cochée n’est pas une trace |
| `correctif` **ou** `reponse` avec `lu` | ⛔ **refusé** — `lu` veut dire « j’ai lu », pas « j’ai corrigé », et il ne notifie personne |
| `ref` qui n’est ni un SHA ni une URL https | ⛔ **refusé** — sinon un agent écrit « corrigé » dans le champ prévu pour le commit |

`ecarte` n’exige rien : il n’y avait rien à corriger.

⚠️ **`note` seule suffit.** C’est l’échappatoire honnête : un correctif qui tient dans une
configuration, un déploiement ou un changement chez l’hôte n’a pas de SHA, et le refuser
obligerait à mentir en inventant une référence.

⚠️ **Les refus sont dits deux fois** : par l’outil MCP **avant le réseau**, avec une phrase que
l’agent peut suivre, et par le serveur, qui rend un `requete_refusee` sec. Les mots viennent d’une
seule fonction, [`refusDuMarquage`](../packages/mcp/src/contrat.ts) — les écrire deux fois, c’était
garantir qu’un jour l’agent lise une règle que le serveur n’applique plus.

---

## 3. ⛔ Feedys ne parle jamais à la forge

La **forme** de `ref` est vérifiée. Son **existence** ne l’est pas, et ne le sera pas.

Aller demander à GitHub si ce commit existe ferait entrer dans le serveur un jeton de forge, une
dépendance réseau et un périmètre qui n’est pas le sien ([D-024](../00-Projet/DECISIONS_LOG.md)).
Conséquence assumée : **un SHA inventé produit un lien mort.** Le lien mort se voit en un clic, ce
qui vaut mieux qu’une vérification silencieuse qu’on aurait cessé de lire.

`produits.url_forge` — posée à la création du produit par `--forge` — sert **uniquement** à
composer `<url_forge>/commit/<sha>`, la forme de GitHub, GitLab et Gitea. Pour les autres, `ref`
accepte une URL complète, qui passe telle quelle.

---

## 4. La persistance

Trois colonnes sur `retours`, une sur `produits`
([0007_correctif.sql](../db/migrations/0007_correctif.sql)) :

| Colonne | Ce qu’elle porte |
|---|---|
| `retours.correctif_ref` | le SHA ou l’URL (≤ 200 car.) |
| `retours.correctif_note` | la phrase pour le développeur (≤ 500 car.) |
| `retours.correctif_le` | quand le correctif a été consigné |
| `produits.url_forge` | l’URL du dépôt, pour composer le lien |

⛔ **Aucune colonne `metadata` fourre-tout.** Quatre colonnes nullables typées.

### 4 bis. ⛔ Le correctif remplace, l’audit s’empile

C’est ce qui garde `marquer_retour` **idempotent** (`idempotentHint: true`), et il faut que les
trois lignes suivantes soient vraies ensemble :

| Le geste | L’état | L’audit |
|---|---|---|
| Marquer `traite` avec un correctif **nouveau** | remplacé, `correctif_le` reposé | une ligne de plus |
| Rejouer **le même** marquage | inchangé — `correctif_le` **ne bouge pas** | une ligne de plus |
| Marquer plus tard **sans** correctif | ⛔ **rien n’est effacé** | une ligne de plus |

⚠️ Sans le premier point, remarquer « traité » une seconde fois ferait croire à une seconde
correction. Sans le troisième, reclasser une étiquette six semaines plus tard ferait disparaître le
commit qui avait réparé le bug — le défaut que P-020 avait déjà payé une fois sur `reponse_texte`.

L’historique complet, lui, vit dans `audit`, qui est **append-only** et n’est pas un état
([conventions-db.md](../04-Architecture/conventions-db.md) §audit). Le détail journalisé porte
`{ avant, apres, par: 'mcp', reponse?, correctif? }`.

---

## 5. Ce que `lire_retour` rend en plus

```ts
reponse:   { texte, envoyee_le, lue_le } | null
correctif: { ref, note, le, url }        | null
```

⚠️ **C’est la moitié de la valeur du dispositif.** Avant, un agent qui rouvrait un retour six
semaines plus tard réécrivait le même mot à quelqu’un qui l’avait déjà lu : le serveur tenait
l’idempotence tout seul, et n’en disait rien à personne. Il voit maintenant ce qui est parti, si
c’est lu, et ce qui avait déjà corrigé.

---

## 6. Ce que le back-office en montre

La fiche `/bo/r/:id` affiche, sous le formulaire de statut :

> Corrigé le 8 septembre 2026 · [`a1b2c3d4`](#) — « reset du tri corrigé dans `useTableState` »

Le SHA est cliquable quand le produit a une `url_forge`, et reste lisible sinon.

⛔ **En lecture seule, et c’est délibéré.** Le correctif se consigne par `marquer_retour`, là où
l’agent a le dépôt sous la main. Un champ de plus au formulaire élargirait la surface modifiable à
la main, que le back-office garde étroite exprès
([back-office.md](back-office.md) §Les seules corrections possibles).

⚠️ Sans cet affichage, la trace n’existerait que pour la machine — et personne ne remarquerait
qu’elle est vide.

---

## 7. Ce qui n’est pas fait

- ⛔ **Aucun quatrième outil MCP.** La traçabilité voyage sur `marquer_retour` parce qu’elle est le
  même geste que « c’est traité ». Trois verbes, et il n’y en aura pas un quatrième
  ([outils.ts](../packages/mcp/src/outils.ts)).
- ⛔ **Aucun appel à la forge**, dans aucun sens — voir §3.
- **Le sens inverse — du commit vers Feedys** (un `Feedys: <id>` dans le message de commit, relevé
  par un hook ou la CI) est différé : [T-009](../00-Projet/TICKETS_DIFFERES.md).
- **Le back-office ne saisit pas de correctif** — voir §6.
