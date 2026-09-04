# Recette du MVP — ce qui a été joué, et ce qui ne l’a pas été

**Jouée le 2026-09-05, pendant P-014.** Contre le conteneur de production (`docker build .`) et,
pour le widget, contre `pnpm widget:demo` — la fausse application hôte volontairement hostile.

⛔ **Ce document n’est pas un rapport de tests.** Les tests, la CI les rejoue. Celui-ci dit ce qu’un
humain a vu en manipulant le produit, y compris ce qu’aucun test ne regardait — c’est là que sont
sortis les deux défauts corrigés dans cette PR.

## Le montage

| | |
|---|---|
| Serveur | l’image de production, `docker run`, contre un Postgres neuf |
| Widget | `widget.js` servi par le serveur, chargé par la fausse app hôte sur un **autre port** |
| Navigateurs | Chrome 152 et Firefox |
| Modèle | ⛔ **coupé** — voir §Ce qui n’a pas pu être joué |
| SMTP | ⛔ **absent** — c’est le point 5 |

## Les huit points

| # | Point | Verdict |
|---|---|---|
| 1 | Parcours nominal, Chrome, **à la voix** | ⛔ **non joué** — modèle absent, et la dictée ne s’automatise pas |
| 2 | Le même **en écrivant**, dans Firefox | ✅ |
| 3 | Fermer le panneau en plein entretien → `abandonne` | ✅ |
| 4 | Couper le modèle → le retour arrive brut | ✅ |
| 5 | Couper SMTP → lisible au back-office et par MCP | ✅ |
| 6 | Un transcript qui tente une injection de prompt | ⛔ **non joué** — modèle absent |
| 7 | Console ouverte : zéro erreur | ✅ **après correctif** — [BUGS_LOG](BUGS_LOG.md) 002 |
| 8 | Le poids réel de `widget.js`, en gzip, **tel que servi** | ✅ **après correctif** — [BUGS_LOG](BUGS_LOG.md) 001 |

## Ce qu’on a vu

### 2 · Firefox, en écrivant

Le panneau s’ouvre **sans micro** : pas de bouton, pas de « maintenir pour parler », pas de
séparateur « ou ». Le champ texte prend toute la place. ⛔ **Aucun message, aucune excuse, aucune
mention de ce qui manque** — exactement ce que [widget.md](../01-Specs/widget.md) demande.

`SpeechRecognition` est bien absent de `window` (D-003). Le retour part : `201` sur
`POST /api/retours`. **Zéro erreur de console.**

### 3 · Le panneau qu’on referme, et la page qu’on quitte

Deux chemins, joués séparément :

- fermeture explicite du panneau en plein entretien → `POST /fin` `200`, retour `abandonne` ;
- **départ de la page** en plein entretien → `pagehide` + `fetch(keepalive)`, retour `abandonne`.

Le second est celui qui compte, et il marche.

### 4 · Le modèle coupé

`POST /tour` rend `503`. Le panneau **reste ouvert**, sans carte — le bot ne prétend pas avoir
compris. Le champ texte reste, et **« Envoyer maintenant » est actif**. L’envoi manuel rend `200`,
le retour passe `envoye` avec son `envoye_le`.

La parole est intégralement en base : `messages.ordre = 0`, le contexte complet, la capture rangée.

⚠️ Deux réserves consignées : [BUGS_LOG](BUGS_LOG.md) 003 (un entretien interrompu en silence reste
`en_cours`) et 004 (l’invite parle d’une fiche absente).

### 5 · SMTP coupé

Le back-office liste les retours et la fiche est complète : le fil brut, le contexte technique, et
un encadré qui dit honnêtement pourquoi il n’y a pas de note — « la parole est en base depuis
l’ingestion, et le fil ci-dessous est intact ».

Par MCP, `GET /api/mcp/retours` et la fiche rendent la même chose, jeton exigé (`401` sans lui).

⚠️ **Une observation, pas un défaut** : sans synthèse, les cinq lignes de la liste sont
indiscernables — « sans note — synthèse absente », cinq fois. La fiche, elle, dit tout. À revoir le
jour où le mode dégradé sera fréquent, pas avant.

### 7 · La console

Zéro erreur, dans les deux navigateurs, **après** le correctif du favicon
([BUGS_LOG](BUGS_LOG.md) 002). Restent deux lignes, et aucune n’est de nous :

- l’avertissement de `@zumer/snapdom`, déjà consigné en [T-005](../00-Projet/TICKETS_DIFFERES.md) ;
- dans Chrome seulement, le journal automatique du navigateur sur la réponse `503` du tour. ⚠️ Il
  n’est écrit par personne — Chrome journalise toute réponse d’erreur — et il disparaît dès que le
  modèle répond. Firefox ne l’écrit pas.

### 8 · Le poids, tel qu’il est servi

Mesuré sur l’image de production, avec les en-têtes qu’un navigateur envoie vraiment :

| `Accept-Encoding` | Octets sur le fil | |
|---|---|---|
| `gzip, deflate, br` | **23 771** — 23,2 Ko | ce que reçoit un vrai navigateur |
| `gzip` | 26 636 — 26,0 Ko | |
| *(aucun)* | 76 655 — 74,9 Ko | un client qui refuse toute compression |

**Budget tenu, avec 34 Ko de marge.** ⛔ Il ne l’était pas avant cette PR : la route servait le
fichier en clair. Voir [BUGS_LOG](BUGS_LOG.md) 001 — le budget était vert et faux en même temps.

## Ce qui n’a pas pu être joué

⛔ **Les points 1 et 6 demandent un modèle**, et ce poste n’a pas de clé. Ils ne sont pas
« probablement bons » : ils sont **non joués**, et ce document ne prétendra pas le contraire.

Ce qui manque, précisément :

- **1** — la boucle complète : le bot lit la parole, pose sa question, la personne répond, la
  synthèse s’écrit, l’email part. Les deux bouts sont vérifiés (l’ingestion, la fiche) ; le milieu
  ne l’est pas de bout en bout par un humain. ⚠️ `entretien:rejouer` et les tests d’intégration le
  couvrent avec un modèle bouchon — ce n’est pas la même chose que de le voir.
- **1 (la voix)** — ⚠️ **ne s’automatise pas, et ne s’automatisera pas.** Web Speech a besoin d’un
  micro et du service de reconnaissance de Google ; un navigateur piloté n’en a ni l’un ni l’autre.
  Ce point restera une manipulation humaine, dans un vrai Chrome, avec une vraie voix.
- **6** — l’injection de prompt. Sans modèle, il n’y a rien à essayer de détourner. ⚠️ Le test
  d’intégration de l’entretien couvre la forme de la parade ; il ne dit pas si **ce** prompt tient
  devant **cette** tentative.

**Ce qu’il faut faire, et quand** : rejouer 1 et 6 avec une clé, avant la première mise en service
chez un hôte. C’est une demi-heure, et c’est la dernière chose qui sépare le MVP de son premier
utilisateur.
