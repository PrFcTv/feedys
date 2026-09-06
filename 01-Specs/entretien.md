# Spécification — l’entretien

> C’est la pièce maîtresse du produit. Tout le reste est de la plomberie autour d’elle.

## Ce que l’entretien doit produire

Un collaborateur parle quarante secondes. À la fin, on doit disposer d’assez de matière pour
remplir la **synthèse** ([synthese.md]) — et savoir dire ce qu’on n’a pas réussi à établir.

L’entretien n’est **pas** une conversation. C’est **au plus trois tours**, et il vaut mieux
s’arrêter tôt avec un trou déclaré que tard avec une personne agacée.

## La machine à états

```
        ┌──────────┐
        │ OUVERT   │  le panneau vient de s’ouvrir, rien n’a été dit
        └────┬─────┘
             │ le collaborateur parle ou écrit
             ▼
        ┌──────────┐
        │ RECU     │  premier message reçu, contexte technique joint
        └────┬─────┘
             │ le modèle produit une compréhension + 0 à 2 questions
             ▼
   ┌──────────────────┐
   │ COMPRIS          │  la carte de compréhension est affichée et corrigeable
   └────┬─────────┬───┘
        │         │ le collaborateur corrige ou répond  ──┐
        │         └──────────────────────────────────────┘  (2 fois au maximum)
        │ « Envoyer » ─ ou ─ 2 relances atteintes ─ ou ─ plus rien n’est utile à demander
        ▼
   ┌──────────┐
   │ ENVOYE   │  synthèse produite, note expédiée, panneau refermé
   └──────────┘
```

**`OUVERT → ENVOYE` est un chemin légal.** Si quelqu’un ouvre, parle et clique immédiatement sur
« Envoyer », on envoie. Le bot n’a pas le droit de retenir.

### ⚠️ Un entretien peut se clore **sans le widget**

Tous les chemins ci-dessus partent d’une requête du navigateur — `POST /fin`, à la fermeture du
panneau ou sur `pagehide`. ⛔ **Ce n’est pas suffisant.** Un onglet tué, un poste éteint, un
`keepalive` que le système laisse tomber, et le retour resterait `en_cours` pour toujours : ni
synthèse, ni email ([BUGS_LOG](../03-Bugs/BUGS_LOG.md) 003).

Le serveur a donc **un filet**. Un entretien sans le moindre signe de vie depuis **trente minutes**
passe en `abandonne`, puis suit le **chemin ordinaire** : même synthèse, même email
([D-018](../00-Projet/DECISIONS_LOG.md)).

⚠️ **Le délai est large à dessein.** Quand tout marche, la clôture arrive en huit secondes après
le dernier message : trente minutes est deux ordres de grandeur au-dessus, et ne peut donc pas
couper quelqu’un qui cherche ses mots.

⛔ **Le widget n’en sait rien et n’a rien à en savoir.** Personne n’est prévenu qu’un entretien a
été refermé : il n’y a plus personne devant l’écran, c’est la définition même du cas.

#### ⛔ Sauf qu’il y a parfois encore quelqu’un

« Sans signe de vie » veut dire « sans requête », pas « sans personne ». Un panneau resté **ouvert**
n’envoie rien : quelqu’un qu’on appelle ailleurs, qui revient trente-cinq minutes plus tard et qui
tape la précision qui manquait, écrit sur un entretien que le filet a déjà refermé.

⛔ **Ce qu’il écrit alors est conservé.** Le serveur enregistre l’apport **avant** de regarder le
statut, dans les deux chemins — `POST /tour` et `POST /fin`. Puis :

| Ce que fait la personne | Ce que le serveur rend | Ce qu’il fait de sa phrase |
|---|---|---|
| « Répondre » | `409 entretien_clos` — l’entretien **ne se rouvre pas** | elle est écrite dans le fil |
| « Envoyer maintenant » | `200`, avec le statut posé par le filet | elle est écrite dans le fil |

Dans les deux cas, si la note n’est **pas encore** partie, elle est reproduite et la contient. Si
elle est déjà partie, la phrase reste lisible au back-office et par MCP — c’est la note qui est
incomplète, pas la parole qui est perdue.

⚠️ **Rien n’est rejoué quand il n’y a rien à ajouter.** Le widget envoie légitimement un abandon en
`pagehide` après un envoi manuel : ce cas-là ne doit ni écrire, ni rappeler le modèle.

## ⛔ Les cinq règles dures

Elles ne se discutent pas, et un manquement est un bug, pas une préférence.

### 1. Ne jamais demander ce que le contexte donne déjà

Sont **déjà connus** au moment où le bot parle : l’URL, le titre de la page, l’écran, le composant
survolé au moment du clic, le navigateur, la taille de la fenêtre, l’heure, l’identité et le rôle
du collaborateur.

⛔ Interdit : « Sur quelle page étiez-vous ? » · « Quel navigateur utilisez-vous ? » · « Pouvez-vous
préciser dans quel écran ? » · « Qui êtes-vous ? »

C’est **la règle la plus importante du document**. Poser ces questions transforme la conversation
en formulaire déguisé et détruit la seule chose que Feedys apporte.

### 2. Deux relances au maximum

Un tour = une prise de parole du bot. Après la deuxième relance, l’entretien se termine
**automatiquement**, quelle que soit la qualité de ce qu’on a. Voir [D-006](../00-Projet/DECISIONS_LOG.md).

### 3. Une question à la fois, deux phrases au maximum

⛔ Pas de liste à puces. Pas de « pourriez-vous préciser a), b) et c) ». Pas de paragraphe.

Une personne qui vient de parler quarante secondes ne lit pas un pavé — elle ferme.

### 4. Ne rien promettre, ne rien diagnostiquer

⛔ Interdit : « c’est un bug connu » · « on va corriger ça » · « avez-vous essayé de vider le
cache ? » · « c’est normal, en fait… » · « merci pour ce retour précieux ».

Le bot ne sait pas ce qui sera fait, et n’a aucune autorité pour le dire. Il **enregistre**.

### 5. « Envoyer maintenant » est visible en permanence

Dès le premier mot, et à chaque tour. On ne piège personne dans un entretien.

## Le ton

Français, vouvoiement, **court**. Le registre est celui d’un collègue attentif qui n’a pas
beaucoup de temps — pas celui d’un assistant enjoué.

⛔ Bannis : « Super ! » · « Excellente remarque » · « Je comprends votre frustration » · « N’hésitez
pas à… » · tout emoji · tout point d’exclamation.

## Ce qu’il est utile de demander

Le bot ne choisit pas ses questions au hasard : il cherche **ce qui manque à la synthèse**, dans
cet ordre de priorité.

| Manque | Question type | Quand |
|---|---|---|
| **Où exactement** — le contexte donne la page, pas le geste | « Qu’est-ce que vous veniez de faire, juste avant ? » | bug |
| **Attendu vs constaté** | « Vous vous attendiez à quoi, à la place ? » | bug |
| **Récurrence** | « C’est la première fois, ou ça revient ? » | bug |
| **Le problème derrière la solution** | « Qu’est-ce que ça vous ferait gagner, concrètement ? » | idée |
| **La fréquence du besoin** | « Ça vous arrive souvent d’en avoir besoin ? » | idée |
| **L’ampleur** | « Ça vous bloque, ou ça vous ralentit ? » | les deux |

⚠️ **Une seule de ces questions par tour.** Le bot choisit celle dont la réponse change le plus la
compréhension du problème — pas celle qui vient en premier dans le tableau.

## La carte de compréhension

C’est le seul écran vraiment neuf du produit, et il ne se comporte **pas** comme un message de
chat.

Après le premier message, le bot n’écrit pas « si je comprends bien, vous dites que… ». Il affiche
**une carte** contenant sa compréhension, en **champs corrigeables sur place** :

```
┌────────────────────────────────────────────────┐
│  Ce que j’ai compris          [ modifier ]     │
│                                                │
│  Un problème                                   │
│  Le tri par date de la liste des dossiers      │
│  se réinitialise au retour sur la page.        │
│                                                │
│  Écran · Liste des dossiers                    │
│  Depuis · quelques jours                       │
└────────────────────────────────────────────────┘

  Vous vous attendiez à quoi, à la place ?
  [ 🎙 maintenir pour parler ]  [ écrire ]  [ Envoyer maintenant ]
```

**Pourquoi une carte et pas une phrase.** Corriger une carte coûte un clic sur le champ faux.
Corriger une phrase oblige à **réexpliquer**, c’est-à-dire à refaire l’effort qu’on venait de
fournir. C’est toute la différence entre « non, c’est l’écran d’à côté » et un deuxième paragraphe
dicté.

Le bot doit donc produire, à chaque tour, **une structure**, pas une prose. La prose est générée
plus tard, pour le développeur, dans la synthèse.

## Le prompt système — première version

À placer dans `apps/serveur/domaine/entretien/prompts/systeme.md`, et à **mettre au point avec
`pnpm entretien:rejouer`** sur de vrais retours plutôt qu’à l’intuition.

```
Tu recueilles le retour d’un collaborateur qui utilise un logiciel métier interne.
Il vient de parler ; sa parole a été transcrite, elle peut être mal ponctuée,
hésitante, ou contenir des mots mal reconnus. Ce n’est pas un rapport de bug :
c’est quelqu’un qui râle ou qui a une idée, entre deux tâches.

TON RÔLE
Comprendre, structurer, et poser au plus une question par tour pour combler le
manque le plus important. Tu n’es pas un agent de support.

CE QUE TU SAIS DÉJÀ — ne le demande jamais
{{contexte}}
Cela inclut la page, l’écran, le composant, le navigateur, l’heure et l’identité.
Demander une de ces informations est une faute.

INTERDITS
- Ne promets rien. Ne dis pas qu’un correctif viendra.
- Ne diagnostique pas. Ne propose aucune solution de contournement.
- Ne remercie pas, ne complimente pas, n’utilise ni emoji ni point d’exclamation.
- Ne pose jamais plus d’une question. Deux phrases maximum.

CE QUE TU PRODUIS
Un objet structuré : ta compréhension actuelle (type, titre, résumé, écran,
récurrence), et soit une question unique, soit rien si tu estimes en savoir assez.

QUAND T’ARRÊTER
Tu poses une question seulement si sa réponse changerait ce qu’un développeur
ferait. Si tu as le type, ce qui se passe et où, arrête-toi : ne demande pas
de précision de confort. Il vaut mieux une note incomplète et honnête qu’un
interrogatoire.

LANGUE
Français, vouvoiement, registre neutre et bref.
```

## Deux échanges, un bon et un mauvais

### ✅ Ce qu’on veut

> **Collaborateur** — « alors euh le tri par date là sur la liste des dossiers dès que je reviens
> en arrière il se remet à zéro et faut que je le refasse à chaque fois c’est pénible »
>
> **Bot** — *[carte : Un problème · Le tri par date de la liste des dossiers se réinitialise au
> retour sur la page]*
> « C’est arrivé depuis un moment, ou c’est nouveau ? »
>
> **Collaborateur** — « non ça a toujours fait ça je crois »
>
> **Bot** — *[carte mise à jour : Depuis · toujours]*
> *[envoi]*

Deux tours. Le bot n’a pas demandé la page — il l’avait. Il n’a pas demandé le navigateur — il
s’en fiche. Il a posé la seule question qui change quelque chose : est-ce une régression ?

### ⛔ Ce qu’on ne veut pas

> **Bot** — « Merci pour ce retour ! 😊 Pour mieux vous aider, pourriez-vous préciser : a) sur
> quelle page vous étiez, b) quel navigateur vous utilisez, et c) les étapes exactes pour
> reproduire le problème ? »

Quatre fautes en une phrase : remerciement, emoji, trois questions d’un coup, et deux
informations déjà connues. C’est un formulaire avec un avatar.

## Le contrat technique

L’appel au modèle est **derrière une seule interface**, `domaine/entretien/modele.ts`, ce qui
permet de l’exercer avec un bouchon en test.

```ts
type TourEntretien = {
  comprehension: {
    type: 'bug' | 'idee' | 'question' | 'gene'
    titre: string           // une phrase, sans point final
    resume: string          // 1 à 3 phrases, à la 3e personne
    ecran?: string          // déduit du contexte, pas demandé
    recurrence?: 'premiere_fois' | 'deja_vu' | 'systematique'
  }
  question: string | null   // null = le bot estime en savoir assez
  motif: string             // pourquoi cette question — journalisé, jamais montré
}
```

⚠️ **Le champ `motif` n’est jamais affiché au collaborateur.** Il sert à la mise au point : quand
une question est mauvaise, c’est le motif qui dit pourquoi le modèle l’a choisie.

## Comment ça se passe sur le fil

Deux routes, et le widget ne compte rien.

| Route | Ce qu’elle fait |
|---|---|
| `POST /api/retours/:id/tour` | un tour : rend `{ comprehension, question, motif }` |
| `POST /api/retours/:id/fin` | l’entretien se termine — `envoi` ou `abandon` |

⛔ **Les deux sont bornées par le `produit_id` déduit de la clé publique**, jamais par un
paramètre de requête. Un identifiant de retour deviné ne donne accès à rien chez un autre produit.

⛔ **Elles sont limitées en débit, plus serré que l’ingestion** : un tour appelle le modèle, donc
il coûte. C’est le seul endroit du produit où le bruit se paie en argent et pas en lignes.

### Le compte des relances

⛔ **Une ligne `bot` du fil = une question posée.** Le compte se fait donc sur ce qui s’est
réellement passé, en base, et pas sur un compteur envoyé par le widget. Forger la requête ne donne
pas une troisième relance : il faudrait forger le fil.

⚠️ Conséquence : **une ligne `bot` n’est écrite que si le bot a posé une question.** Un dernier
tour sans question ne laisse pas de trace dans le fil — sa carte est rendue au widget, et c’est la
**synthèse** qui est l’artefact structuré ([D-013](../00-Projet/DECISIONS_LOG.md)).

### Ce que la carte devient quand on la corrige

⛔ **La carte n’est pas stockée.** Une correction entre dans le fil comme ce qu’elle est — la
personne qui reprend le bot — sous la forme d’une ligne `collaborateur` préfixée
`Correction · ` : `Correction · Écran — Liste des mandats`.

⚠️ **Elle voyage avec le tour suivant, ou avec la fin.** C’est ce qui permet de n’avoir aucun
bouton « valider » sans jamais perdre une correction, y compris quand on corrige puis qu’on clique
immédiatement sur « Envoyer maintenant ». Idem pour ce qui vient d’être écrit : **le texte en cours
part avec la fin**, parce qu’on a cliqué sur « Envoyer », pas sur « jeter ».

### Quand `comprehension` vaut `null`

Quand le transcript n’a rien d’intelligible, le bot relance **sans carte**. Une compréhension
fabriquée sur du vide serait un mensonge, et la carte est précisément l’endroit où le produit
promet de ne pas mentir.

## Modes de défaillance à traiter explicitement

| Cas | Comportement attendu |
|---|---|
| Le modèle ne répond pas / expire | La carte n’apparaît pas, le champ texte reste, « Envoyer » fonctionne. **Le retour brut part quand même** — jamais perdu. |
| Le transcript est vide ou inintelligible | Une seule relance : « Je n’ai pas bien saisi — vous pouvez redire ? ». Puis on envoie le brut. |
| Le collaborateur répond à côté | Ça compte comme un tour. On ne réinsiste pas sur la même question. |
| Le collaborateur ferme le panneau en cours d’entretien | Le retour est **conservé et envoyé** en l’état, marqué `abandonne`. Un retour partiel vaut mieux que rien. |
| Le filet referme pendant que le panneau est encore ouvert | Ce que la personne écrit ensuite est **écrit dans le fil quand même**, avant toute garde de statut, et la note est reproduite si elle n’est pas partie ([BUGS_LOG](../03-Bugs/BUGS_LOG.md) 009). |
| Le collaborateur dit quelque chose de personnel ou sur quelqu’un | Le bot ne relance pas, ne commente pas, transmet tel quel. Ce n’est pas son rôle d’arbitrer. |

⛔ **Aucun de ces cas ne perd le retour.** C’est l’invariant : une fois que quelqu’un a parlé, sa
parole arrive au développeur, quoi qu’il advienne du modèle, du réseau ou du navigateur.

⚠️ **L’abandon passe par `pagehide` et une requête `keepalive`.** Sans elle, le navigateur annule
l’appel au moment où la page se ferme, et le retour resterait `en_cours` pour toujours — ce qui
n’est pas une perte de parole, mais une perte de statut, et personne ne le verrait.

## La mise au point du prompt

```bash
pnpm entretien:rejouer -- --retour <id> [--modele <id>] [--prompt]
```

L’outil rejoue la boucle sur un retour existant, **sans widget et sans navigateur**. À chaque
endroit où le bot avait parlé, il montre côte à côte **ce qui avait été demandé** et **ce que le
prompt d’aujourd’hui demanderait**. `--prompt` imprime le prompt système assemblé : quand une
question est mauvaise, la première chose à regarder est ce que le modèle a réellement lu.

⛔ **Il n’écrit rien** — ni message, ni statut, ni synthèse. Un outil de mise au point qui modifie
ce qu’il mesure ne mesure plus rien.
