# Architecture

## Vue d’ensemble

```
   LOGICIEL HÔTE (VictorIA, portail CGP, …)      FEEDYS (un conteneur)
  ┌──────────────────────────────────┐         ┌────────────────────────────────┐
  │                                  │         │                                │
  │  <script src=".../widget.js">    │────────▶│  GET /widget.js                │
  │        │                         │         │      sert le bundle Preact     │
  │        ▼                         │         │                                │
  │  ┌──────────────┐                │         │  POST /api/retours             │
  │  │ shadow DOM   │  clé publique  │────────▶│      ingestion + contexte      │
  │  │ le widget    │  + identité    │         │            │                   │
  │  └──────────────┘  signée        │         │            ▼                   │
  │                                  │◀────────│  POST /api/retours/:id/tour    │
  │  serveur de l’hôte               │         │      la boucle d’entretien     │
  │    signe l’identité ─────────────┼─────────│            │                   │
  │    avec le secret produit        │         │            ▼                   │
  └──────────────────────────────────┘         │  synthèse → email + base       │
                                               │                                │
                                               │  /bo   back-office (1 personne)│
                                               │  MCP   pour l’agent de code    │
                                               └──────────┬─────────────────────┘
                                                          ▼
                                                    PostgreSQL
```

**Une seule chose se déploie** : le conteneur Feedys. Le widget n’est pas un artefact séparé, il
est **servi par le serveur** — c’est ce qui garantit qu’une mise à jour atteint les quatre
logiciels sans qu’aucun ne redéploie, et c’est aussi ce qui tient la frontière de licence.

## La carte du dépôt

```
apps/serveur/                     AGPL-3.0
  app/                            routage Next.js UNIQUEMENT — pages fines
    (bo)/                         le back-office
    api/                          l’API d’ingestion et d’entretien
    widget.js/route.ts            sert le bundle du widget
  domaine/                        LA logique métier — pure, testable sans base
    retours/
    entretien/
      modele.ts                   ⚠️ LE SEUL point d’appel au modèle
      prompts/
    synthese/
    contexte/
    identite/
  infra/                          base, email, stockage — les effets de bord
  ui/                             composants du back-office (React + shadcn)

packages/widget/                  MIT
  src/
    contrat.ts                    ⚠️ le contrat de transport — le serveur l’IMPORTE
    montage.ts                    shadow DOM, cycle de vie, isolation
    composants/
    dictee/
  demo/                           la fausse app hôte hostile (pnpm widget:demo)

packages/mcp/                     MIT

db/migrations/                    SQL brut, source de vérité
prisma/schema.prisma              miroir typé
```

## Les frontières, et ce qui les vérifie

### ⛔ 1. `packages/widget` n’importe rien de `apps/serveur`

C’est la frontière de licence ([licences.md]). Elle est vérifiée par une règle ESLint de
`no-restricted-imports`, et **un manquement casse le check `lint`**.

Le sens de la dépendance est **inversé par rapport à l’intuition** : c’est `apps/serveur` (AGPL)
qui importe `packages/widget/src/contrat.ts` (MIT), jamais l’inverse. Du code MIT peut être
consommé par du code AGPL ; le contraire contaminerait.

### ⛔ 2. `apps/serveur/app/` ne contient que du routage

Aucune logique métier dans une page ou une route. Elles valident l’entrée, appellent
`domaine/`, et rendent. Si une route dépasse une trentaine de lignes, la logique est au mauvais
endroit.

### ⛔ 3. `domaine/` ne connaît ni la base, ni le réseau, ni le modèle

Tout ce qui a un effet de bord entre par un port passé en argument. C’est ce qui rend l’entretien
testable sans clé d’API et sans Postgres — et donc réellement testé.

### ⛔ 4. Un seul point d’appel au modèle

`domaine/entretien/modele.ts` est la **seule** frontière avec le fournisseur. Ni les routes, ni
les composants, ni `infra/` n’appellent un LLM.

Trois bénéfices, dont un décisif : les tests tournent avec un bouchon, le prompt est au même
endroit que son appel, et **on peut changer de modèle en éditant un fichier**.

## Le flux d’un retour, de bout en bout

| # | Ce qui se passe | Où |
|---|---|---|
| 1 | Le collaborateur clique. Le widget prend la capture et le contexte. | widget |
| 2 | Il parle. Web Speech transcrit en direct, sous ses yeux. | widget |
| 3 | `POST /api/retours` — transcript **ou** audio, contexte, identité signée. | serveur |
| 4 | La clé est vérifiée, l’identité validée, le retour est **écrit en base immédiatement**. | `domaine/retours` |
| 5 | `POST /api/retours/:id/tour` — le modèle rend compréhension + question. | `domaine/entretien` |
| 6 | La carte s’affiche. Le collaborateur corrige ou répond. Retour en 5, deux fois au plus. | widget |
| 7 | Fin d’entretien : `generateObject` produit la synthèse typée. | `domaine/synthese` |
| 8 | La note part par email. Elle devient lisible par MCP et dans le back-office. | `infra` |

⛔ **L’étape 4 est un invariant : le retour est persisté avant tout appel au modèle.** Si le
modèle échoue, expire, ou si le collaborateur ferme l’onglet, **la parole est déjà sauvée**. Rien
de ce qui a été dit ne peut être perdu par une défaillance en aval.

## Sécurité — le modèle de menace réel

Le dépôt est public et le widget s’exécute chez autrui. Ce qu’on protège, dans l’ordre :

| Risque | Réponse |
|---|---|
| N’importe qui poste des retours avec la clé publique (elle est dans le HTML) | C’est **accepté par conception** — une clé publique est publique. On limite le débit par clé et par IP, et on borne la taille. Le pire cas est du bruit, pas une fuite. |
| Quelqu’un se fait passer pour un collaborateur | L’identité est **signée par le serveur de l’hôte** avec le secret produit. Non signée = retour accepté mais marqué `identite: non_verifiee`. |
| Injection de prompt dans la parole dictée | Le transcript est **une donnée, jamais une instruction**. Il est passé en message utilisateur, jamais concaténé au prompt système. La sortie est contrainte par schéma : au pire le modèle produit une mauvaise synthèse, il ne peut pas changer de rôle. |
| Le widget exfiltre le contenu de la page hôte | La capture et le sélecteur DOM sont les **seules** données de page collectées, et [widget.md] les énumère de façon close. C’est vérifiable : le code est public. |
| Fuite de données entre produits | Toute requête est bornée par le `produit_id` déduit de la clé. Jamais par un paramètre client. |

⚠️ **Ce qui n’est pas un objectif** : résister à un collaborateur malveillant qui aurait le secret
de l’hôte. Ce n’est pas le modèle de menace d’un outil interne à dix personnes.

## Ce qui est délibérément absent

- **Pas de file d’attente, pas de worker.** L’entretien est synchrone, l’email part dans la
  requête. À ce volume — quelques dizaines de retours par jour — une file ajouterait un composant
  à exploiter pour aucun gain.
- **Pas de cache.** Rien n’est assez lu pour le justifier.
- **Pas de temps réel.** Le back-office se rafraîchit quand on l’ouvre.
- **Pas de microservices.** Un conteneur, un Postgres.

Chacun de ces manques est un choix, pas un oubli. Les réintroduire demande une entrée au
[DECISIONS_LOG](../00-Projet/DECISIONS_LOG.md).
