# Glossaire

Ces mots sont ceux du code. Une table, un type, une variable ou un libellé qui parle d’autre
chose est un bug de vocabulaire — et il coûte cher, parce qu’il se propage.

## Les sept mots

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

#### Axe

**Une question du bot dont la réponse tient dans une liste close** — la récurrence, l’ampleur. Le
bot déclare l’axe ; le dépôt écrit les mots des boutons. La personne répond **d’un clic**.

⛔ Pas « suggestion » : le mot est déjà pris, avec le sens inverse — [01-Specs/synthese.md] interdit
« toute suggestion technique » dans la note. Pas « quick chip » ni « quick reply » : anglicismes
sans nécessité. Pas « option » ni « choix » : ni l’un ni l’autre n’est obligatoire, et les nommer
ainsi ferait croire qu’il faut trancher.

⛔ **Un axe n’est pas un champ de formulaire.** Il n’existe que là où le bot a posé une question, il
disparaît avec elle, et le micro comme le champ texte restent au même niveau en dessous.

#### Geste

**Ce qui, dans le fil, vient de la personne sans être sa parole** : une correction de la carte, une
réponse d’un clic. Le texte de ces lignes est écrit par Feedys, pas dicté.

⛔ **Un geste n’est jamais cité.** C’est la distinction qui empêche la note de mettre les mots du
bot entre guillemets ([03-Bugs/BUGS_LOG.md] 016). Colonne `messages.geste` ; `NULL` veut dire
« elle l’a dit ».

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

### Indice

**Ce que le navigateur a relevé tout seul, avant qu’on ouvre la bulle** : une exception non
capturée, ou une requête revenue en erreur.

⛔ **Pas « erreur »** — ambigu avec les erreurs de Feedys lui-même, et surtout affirmatif : une
erreur *est* le problème, un indice ne fait que le suggérer. ⛔ Pas « log », pas « trace », pas
« breadcrumb » : trois mots qui appellent un journal, et un journal ne se lit pas dans une fiche
de retour.

⚠️ **Le mot porte la règle.** Un indice dit *piste*, jamais *cause* : c’est au développeur de faire
le lien, et l’écart affiché — « il y a 3 s », « il y a 2 h » — est ce qui l’y aide. Le bot, lui, ne
le fait jamais : il s’en sert pour **ne pas demander** ce qu’on sait déjà, jamais pour diagnostiquer
([entretien.md](../01-Specs/entretien.md) règle 4).

⛔ **Un indice ne porte pas le message d’une exception**, seulement son nom et sa première trame.
Un message est du texte libre écrit par le logiciel hôte, et il y met des noms de personnes
([D-026](../00-Projet/DECISIONS_LOG.md)).

Table `indices`. Trois au plus par retour.

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
