# Spécification — le back-office

**Un seul lecteur, connu, deux visites par jour.** Régime inverse de celui du widget : le
back-office est chez lui. Il peut avoir du caractère, et il doit avoir de la **densité**.

⛔ **Ce n’est pas un tableau de bord.** Ni compteur, ni graphique, ni « retours cette semaine ». Le
lecteur ne vient pas mesurer, il vient chercher un retour précis et décider quoi en faire.

## Les trois écrans

| Route | Ce que c’est |
|---|---|
| `/connexion` | un champ, un bouton |
| `/bo` | la liste — filtres statut, type, zone, date |
| `/bo/r/:id` | la fiche — la note, le fil, le contexte |

⚠️ `GET /bo/r/:id/capture` sert la capture d’écran. **Le client donne l’id du retour, jamais un
chemin** : le chemin est lu en base, et la lecture refuse de toute façon tout ce qui sort de la
racine de stockage. La route est derrière la session — une capture d’un logiciel métier montre des
dossiers réels et des noms de personnes.

## La liste

Une ligne par retour, deux lignes de haut, cliquable en entier : le lecteur **parcourt**, il ne
vise pas. Y figurent le titre, l’âge, le type, le statut, la zone, le produit, l’auteur et la
source.

⚠️ **La confiance basse se voit depuis la liste.** Une note en confiance basse se lit
différemment — on ne planifie pas dessus, on va voir la personne — et attendre d’ouvrir la fiche
pour l’apprendre est trop tard.

⚠️ **Un retour sans titre est un retour sans note** : la synthèse a échoué, ou l’entretien s’est
refermé sans un mot. On le dit à la place du titre, plutôt que de laisser une ligne vide qu’on
prendrait pour un défaut d’affichage.

### Les filtres vivent dans l’URL

Un `<form method="get">`, et rien d’autre. Les filtres se recopient dans un message, se mettent en
favori, survivent à un rechargement. Une barre de filtres pilotée par un état de client perd les
trois.

⚠️ **Ce qui n’est pas reconnu est ignoré, jamais refusé.** Une liste est une lecture : un paramètre
d’URL abîmé rend la liste complète, pas une page d’erreur. ⛔ Les valeurs reconnues, elles, sont une
**liste close** — c’est ce qui empêche un paramètre d’URL d’atteindre le SQL.

### Deux états vides, pas un

⛔ **Les états vides sont des écrans, pas des phrases grises.**

- **aucun retour du tout** — c’est le premier écran que le développeur verra. Il dit quoi faire
  ensuite : poser la balise, puis dicter un retour soi-même pour vérifier la chaîne complète ;
- **rien ne correspond aux filtres** — les retours sont là, ce sont les filtres qui serrent trop.
  Un bouton ramène à la liste entière.

## La fiche

⛔ **L’ordre est imposé : la note, PUIS le fil de l’entretien, PUIS le contexte et la capture.**
Le contexte va en dernier parce qu’on ne le lit qu’en cas de besoin.

### ⛔ Le fil brut n’est jamais replié

Pas de « voir les détails », pas d’accordéon, pas de « afficher les 4 messages restants ». La
synthèse est une **lecture** ; le fil est la **source**. Cacher la source revient à décider que la
reformulation du modèle vaut mieux que la parole d’origine.

⚠️ Le `transcript_brut` est montré sous le message **quand il en diffère** : on garde les
hésitations, elles portent du sens.

### Les verbatims ont leur typographie

Mono, retrait, filet à gauche. Ce sont des **pièces**, pas de la prose : le lecteur doit voir au
premier coup d’œil ce que la personne a dit et ce que le modèle en a fait.

## ⛔ Ce qui se corrige — et ce qui ne se corrige pas

**Trois champs, et pas un de plus.**

| Champ | Pourquoi |
|---|---|
| `statut` | `lu`, `traite`, `ecarte` — les trois qu’une personne pose |
| `type` | le modèle se trompe, et une note mal classée est une note perdue |
| `zone` | idem |

⛔ **Ni le résumé, ni les citations, ni le fil.** Le texte d’un `message` ne se modifie jamais et ne
se supprime jamais, ni par le back-office, ni par le MCP, ni pour corriger une typo
([conventions-db.md](../04-Architecture/conventions-db.md)).

⛔ **`en_cours`, `abandonne` et `envoye` ne se posent pas à la main.** Ils décrivent le déroulé de
l’entretien : les réécrire falsifierait l’histoire du retour. Même liste que celle du MCP.

### Le refus est côté serveur, et il est dit

Les schémas de `domaine/backoffice/correction.ts` sont `.strict()`, et le `FormData` leur est passé
**entier** : un formulaire forgé qui ajoute `resume`, `texte` ou `citations` se heurte à un
**refus**, pas à un haussement d’épaules. Le message revient dans la page, à côté du bouton.

⚠️ L’interface ne montre pas ces champs — mais ce n’est pas ce qui protège. Le verrou est le schéma.

### Chaque changement laisse une trace

⛔ La correction et sa ligne d’`audit` partent **dans la même transaction**, ou pas du tout. La
ligne porte l’**avant et l’après** : sans l’avant, elle ne dit rien. L’acteur est `developpeur`.

⚠️ `select … for update` fige la ligne le temps de lire l’avant : sans lui, deux corrections
concurrentes journaliseraient le même « avant ».

## L’accès

**Une personne, un mot de passe (`FEEDYS_BO_MOT_DE_PASSE`), une session.**

⛔ Pas de rôles, pas d’inscription, pas de « mot de passe oublié ». Un système de comptes serait
plus de code, plus de surface d’attaque, et zéro utilisateur de plus.

⚠️ Le jeton de session est un HMAC de sa date d’expiration, dont le **secret est dérivé du mot de
passe**. Changer le mot de passe invalide toutes les sessions ouvertes, sans liste de sessions ni
seconde variable d’environnement.

⚠️ **La garde est posée deux fois** : sur l’affichage (la disposition de `/bo`) et dans **chaque
action de serveur**. Une garde posée seulement sur l’affichage protège l’écran, pas l’écriture — et
c’est l’écriture qui compte.

⚠️ Le message d’échec est le même quelle que soit la cause — mot de passe faux, ou back-office non
configuré. Distinguer les deux dirait à un visiteur si l’instance a un mot de passe.

## ⚠️ Le pied de page — article 13 de l’AGPL

Le pied de page porte **le lien vers le dépôt et la version déployée**. Ce n’est pas une politesse :
quiconque interagit avec Feedys à travers un réseau a droit à la source **de la version qui
tourne**. Un lien vers le dépôt sans la version ne suffit pas.

`FEEDYS_VERSION` est posée à la construction de l’image ; sur un poste elle est absente, et « dev »
est la réponse honnête.

## Ce que ça n’a pas, et n’aura pas

- **Aucun vote, aucun classement, aucun tri par popularité.** Feedys écoute dix collaborateurs
  identifiés, pas mille inconnus ([VISION.md](../00-Projet/VISION.md)).
- **Aucune suppression.** Un retour qui ne mérite rien passe en `ecarte`. Il n’est pas détruit.
- **Aucune pagination.** Deux visites par jour, dix personnes : la liste est plafonnée à 200 lignes
  et ça suffira longtemps. Le jour où ça ne suffira plus, ça se verra.
- **Aucun rapprochement entre retours.** Hors MVP, et le suggérer trop tôt produirait des faux liens
  que personne ne vérifierait.
