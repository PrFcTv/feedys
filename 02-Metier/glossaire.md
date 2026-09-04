# Glossaire

Ces mots sont ceux du code. Une table, un type, une variable ou un libellé qui parle d’autre
chose est un bug de vocabulaire — et il coûte cher, parce qu’il se propage.

## Les six mots

### Retour

**L’unité du produit.** Ce qu’une personne a voulu dire, une fois. Un retour naît quand quelqu’un
parle, il vit le temps de l’entretien, il finit en synthèse.

⛔ **On ne dit jamais « ticket ».** Un ticket appelle un guichet, une file d’attente et un numéro —
trois choses que Feedys n’a pas et n’aura pas. La règle porte sur les libellés, les messages, la
documentation, les commentaires, **et les noms de tables, de types et de variables**.

⛔ On ne dit pas non plus « feedback » (anglicisme, et trop vague), ni « demande » (ce n’en est pas
toujours une), ni « signalement » (trop administratif, et faux pour une idée).

Table `retours`. Type `Retour`.

### Entretien

**Les échanges entre le collaborateur et le bot**, du premier mot à l’envoi. Au plus trois tours.

⛔ Pas « conversation » (trop long, trop libre), pas « chat » (anglicisme, et suggère qu’on répond
en face), pas « formulaire » (c’est exactement ce qu’on refuse d’être).

Spécifié dans [01-Specs/entretien.md]. Table `messages`, une ligne par tour.

### Synthèse

**La note produite à la fin**, destinée au développeur. Typée, produite une fois, jamais réécrite.

⛔ Pas « résumé » : la synthèse contient des choses qui ne sont pas dans le fil, notamment ce que
l’entretien **n’a pas** établi.

Table `syntheses`. Spécifiée dans [01-Specs/synthese.md].

### Produit

**Un logiciel métier qui embarque le widget.** VictorIA est un produit. Le portail CGP en est un
autre.

⛔ Pas « client », pas « organisation », pas « espace », pas « projet ». Il n’y a **pas de
multi-tenant** ici : un seul développeur, plusieurs de ses propres logiciels. Voir
[D-005](../00-Projet/DECISIONS_LOG.md).

Table `produits`. Porte une clé publique et un secret.

### Contexte

**Ce que le widget joint tout seul** : l’URL, l’écran, le composant, le navigateur, la fenêtre, la
capture, l’horodatage.

⛔ Pas « métadonnées » — c’est le mot qui fait naître les colonnes JSON fourre-tout, interdites
par [conventions-db.md](../04-Architecture/conventions-db.md).

Le contexte est ce qui rend l’entretien court : **tout ce qui est dans le contexte est une question
qu’on ne pose pas.**

Table `contextes`.

### Auteur

**La personne qui a parlé.** Identifiée par le logiciel hôte, jamais par Feedys — elle n’a pas de
compte ici et ne s’inscrit nulle part.

⛔ Pas « utilisateur » (ambigu : de Feedys ou du logiciel hôte ?), pas « client », pas
« reporter ».

Champs `auteur_ref`, `auteur_nom`, `auteur_role` sur `retours`.

## Les états d’un retour

| État | Ce qu’il veut dire |
|---|---|
| `en_cours` | l’entretien n’est pas terminé — la personne est encore là |
| `abandonne` | le panneau a été fermé en cours d’entretien. **Le retour part quand même** |
| `envoye` | la synthèse est produite, la note est partie |
| `lu` | le développeur l’a ouverte |
| `traite` | quelque chose a été fait |
| `ecarte` | rien ne sera fait. ⚠️ C’est un état **légitime**, pas un échec — mais il n’efface rien |

⛔ Il n’y a **ni priorité, ni sévérité, ni score**. Arbitrer est le travail du développeur, et un
modèle qui note à sa place fabrique une fausse objectivité qu’on finit par suivre.

## Les types de retour

| Type | Ce que c’est | La question qui va avec |
|---|---|---|
| `bug` | ça ne fait pas ce que ça devrait | qu’est-ce que vous attendiez ? |
| `idee` | ça pourrait faire quelque chose de plus | qu’est-ce que ça vous ferait gagner ? |
| `question` | je ne comprends pas pourquoi c’est comme ça | — souvent le signal d’un défaut de conception |
| `gene` | ça marche, mais c’est pénible | ça vous bloque, ou ça vous ralentit ? |

⚠️ **`gene` est le type qui justifie le produit.** Ce sont les frictions qui ne remontaient jamais
parce qu’elles ne valaient pas un email. Si Feedys n’en reçoit pas, il a échoué
([VISION.md](../00-Projet/VISION.md) §Le succès).

⚠️ Et **`question` est le plus précieux à lire** : « je ne comprends pas pourquoi on fait comme
ça » ne dit pas qu’il y a un bug, il dit que le modèle métier est mal exprimé quelque part.

## Les mots anglais qu’on garde

Sans état d’âme, parce qu’ils sont ceux du métier technique et qu’il n’y a pas d’équivalent
français utile : `widget`, `shadow DOM`, `bundle`, `token` (au sens CSS), `MCP`, `commit`, `PR`.

⛔ En revanche, l’interface et la documentation sont **en français**, y compris les messages
d’erreur, les états vides et les libellés de boutons.
