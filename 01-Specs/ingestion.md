# Spécification — l’ingestion d’un retour

`POST /api/retours` est **la seule porte d’entrée de la parole**. Tout ce qui vient après —
l’entretien, la synthèse, l’email — se branche derrière elle et **ne peut pas la faire échouer**.

## ⛔ L’invariant

**Le retour est persisté avant tout appel en aval.** Si le modèle tombe, si le SMTP expire, si le
collaborateur ferme son onglet une seconde après avoir cliqué — la parole est déjà en base.

C’est visible dans la signature plutôt que dans un commentaire : `domaine/retours/ingestion.ts`
prend un port `aval`, il l’appelle **après** `depot.enregistrer`, et son échec est avalé.
`ingestion.test.ts` le prouve en faisant échouer l’aval et en vérifiant qu’on répond quand même
`201`.

## La requête

```http
POST /api/retours
x-feedys-cle: fdy_pub_…
x-feedys-identite: <charge>.<signature>      ⚠️ facultatif
content-type: application/json
origin: https://victoria.exemple.fr
```

Le contrat de transport vit dans **`packages/widget/src/contrat.ts`**, côté MIT, et le serveur
l’importe — jamais l’inverse ([licences.md](../04-Architecture/licences.md)).

```jsonc
{
  "texte": "le tri de la colonne date remet tout à zéro quand je reviens",
  "transcriptBrut": "euh le tri de la colonne date remet tout à zéro…",
  "audio": { "type": "audio/webm", "donnees": "<base64>" },
  "source": "voix",
  "contexte": {
    "url": "https://victoria.exemple.fr/dossiers?tri=date",
    "titrePage": "Dossiers — VictorIA",
    "ecran": "dossiers",
    "selecteurDom": "table.dossiers th:nth-child(3)",
    "navigateur": "Chrome 141",
    "systeme": "Windows 11",
    "viewportL": 1920,
    "viewportH": 1080,
    "fuseau": "Europe/Paris",
    "horodatage": "2026-09-04T11:32:00.000Z",
    "agentBrut": { "langue": "fr-FR" },
    "capture": { "type": "image/webp", "donnees": "<base64>" },
    "indices": [
      { "genre": "http", "statut": 500, "chemin": "/api/dossiers/:id/valider", "ecartMs": 3200 },
      { "genre": "js", "nom": "TypeError", "trame": "trier (dossiers.js:88:12)", "ecartMs": 4100 }
    ]
  }
}
```

⛔ **`texte` OU `audio` — au moins l’un des deux.** Le serveur ne suppose **jamais** que la
transcription s’est faite chez le client : c’est ce qui ouvrira Whisper le jour où Chrome n’est
plus tenable, sans réécriture ni migration.

⛔ **Les deux listes de champs sont closes** : ce qui n’y est pas **n’atteint jamais la base**. La
liste du contexte est celle de [widget.md](widget.md) §Ce que le widget joint tout seul, mot pour
mot. Le dépôt est public : elle doit pouvoir être lue par n’importe qui sans gêne.

⚠️ **Depuis P-030, un champ inconnu est RETIRÉ, plus refusé** — sauf dans un indice (juste en
dessous). Refuser le corps entier faisait perdre la parole d’un widget plus récent que le serveur,
après un retour arrière (§La règle des versions).

⛔ **`indices` est plafonné à TROIS par le serveur** ([D-026](../00-Projet/DECISIONS_LOG.md)), pas
par le widget : un widget forgé ne doit pas pouvoir transformer un retour en déversoir de journal —
même raisonnement que la limite de deux relances, qui n’est pas confiée au navigateur non plus.
Un `js` doit porter son `nom`, un `http` son `statut` **et** son `chemin` ; le reste est refusé.

⛔ **Et un indice n’a PAS de champ `message`.** Un corps qui en porterait un est refusé en `400` —
pas ignoré, refusé. `error.message` est écrit par le code de l’hôte et porte régulièrement des noms
de personnes et de dossiers ; le `.strict()` du schéma est ce qui transforme cette règle en mur
plutôt qu’en intention. Les trois lignes sont rangées dans la table `indices`, dans la même
transaction que la parole.

⚠️ **C’est le seul schéma resté `.strict()`**, et c’est ce mur qui le veut. Conséquence : un indice
ne gagne jamais de champ. Et pour qu’un refus d’indice ne coûte jamais la parole, **le widget, sur
un `400`, renvoie une fois le retour sans capture ni indices** (`packages/widget/src/envoi.ts`) —
ce sont des aide-mémoire, la parole est ce qui doit passer.

⚠️ **`source` est déclaré par le widget**, parce qu’un transcript Web Speech est de la voix **sans
fichier audio** — le serveur ne peut pas le deviner. Avec un audio, il vaut `voix` quoi qu’il
arrive. Ce n’est pas décoratif : c’est la mesure du pari du produit.

⚠️ **`horodatage` est indicatif.** `cree_le` fait foi, posé par la base : une horloge de poste peut
être fausse de plusieurs heures.

## Les réponses

| Code | Motif | Quand |
|---|---|---|
| `201` | — | `{ "retour": "<id>" }` — les trois lignes sont écrites |
| `400` | `corps_invalide` | JSON illisible, champ inconnu **dans un indice**, ni texte ni audio, borne dépassée |
| `401` | `cle_absente` | pas de `x-feedys-cle`, ou une valeur qui n’est pas une `fdy_pub_…` |
| `403` | `origine_refusee` | l’`Origin` n’est pas celle du produit |
| `404` | `produit_inconnu` | clé inexistante **ou** produit désactivé |
| `413` | `corps_trop_gros` | au-delà de 4 Mio, capture et audio compris |
| `429` | `debit_depasse` | 60 requêtes/min par clé, 20/min par IP |
| `503` | `stockage_indisponible` | l’audio n’a pas pu être rangé |

⚠️ **`404` couvre volontairement deux cas.** Distinguer « clé inconnue » de « produit désactivé »
dirait à un curieux qu’une clé trouvée dans un HTML existe encore.

⚠️ **Les en-têtes CORS accompagnent aussi les refus.** Sans eux, le navigateur cacherait la
réponse au widget, qui n’aurait qu’une « erreur réseau » à afficher au lieu du motif.

## La règle des versions

⚠️ **Un widget et le serveur qui le sert peuvent avoir une version d’écart**
([T-012](../00-Projet/TICKETS_DIFFERES.md), [D-030](../00-Projet/DECISIONS_LOG.md)). `widget.js` est
gardé un jour en `stale-while-revalidate`, et un onglet de logiciel métier reste ouvert toute la
journée : après une mise à jour du serveur, le widget d’hier envoie encore ; après un retour
arrière, c’est le widget de demain qui parle à l’ancien serveur.

⛔ **La règle, pour toute route que le widget appelle :**

1. **un champ de requête nouveau est toujours facultatif** — le widget d’hier ne l’enverra pas ;
2. **une enveloppe de requête ignore ce qu’elle ne connaît pas** — le serveur d’hier ne doit pas
   refuser la parole pour un champ de demain. `SchemaCorpsRetour`, `SchemaContexte`,
   `SchemaCorpsTour` et `SchemaCorpsFin` ne sont plus `.strict()` ;
3. **un champ de réponse ne se renomme ni ne disparaît** — le widget lit ses réponses à la main,
   sans zod, et un renommage casserait en silence tous les onglets ouverts. Un champ de réponse
   **nouveau** est libre ;
4. ⛔ **`SchemaIndice` reste `.strict()`** — le mur de [D-026](../00-Projet/DECISIONS_LOG.md). Un
   indice ne gagne donc jamais de champ, et le widget renvoie la parole sans indices sur un `400`.

⛔ **Un retour arrière ne demande aucune consigne** — ni attendre un jour, ni faire recharger les
onglets, ce que personne ne pourrait imposer aux salariés d’un client.

**Ce qui la tient** : `apps/serveur/app/api/retours/compatibilite.test.ts`. Il relit les corps que
le widget `1.0.0` envoie — **écrits à la main et figés** dans `tests/versions/widget-1.0.0.ts` —
contre les schémas d’aujourd’hui, en exigeant que **rien n’en soit retiré** ; et il relit les
réponses d’aujourd’hui — les enveloppes des routes (`_reponses.ts`), `jouerTour`, le dépôt de
relève — avec ce que `1.0.0` en lit. Vérifié en renommant un champ de requête : il rougit.

⚠️ **À chaque version publiée, un fichier de plus** dans `tests/versions/`, et le test le relit
aussi. On ne réécrit jamais celui d’une version déjà chez un client.

## Ce qui est écrit, et où

Trois lignes, **en une transaction** — elles partent ensemble ou pas du tout. Un retour sans son
message serait une parole perdue avec l’air d’avoir été reçue.

| Table | Ce qui y va |
|---|---|
| `retours` | `produit_id`, `source`, `statut = 'en_cours'`, et l’auteur — `auteur_ref`, `auteur_nom`, `auteur_role`, `identite_verifiee` |
| `messages` | `ordre = 0`, `role = 'collaborateur'`, `texte`, `transcript_brut`, `audio_chemin` |
| `contextes` | la liste close, plus `capture_chemin` |

⚠️ **`texte` vaut `''` quand seul l’audio est arrivé.** La transcription serveur viendra remplir la
ligne, elle ne la créera pas.

Les octets — audio et capture — vivent sur le volume `FEEDYS_STOCKAGE`, rangés en
`<genre>/<année>/<mois>/<id>.<ext>`. ⛔ Le nom de fichier est un identifiant tiré au hasard :
jamais le titre de la page, jamais l’écran, jamais le nom de quelqu’un.

## Les échecs, et leur asymétrie

- **La capture est un confort** → échec **doux**. Le chemin reste `null`, le retour part quand
  même. Un retour sans image vaut infiniment mieux qu’un retour perdu.
- **L’audio est la parole** quand il n’y a pas de transcript → échec **bruyant** (`503`). Le
  widget peut réessayer ; une perte silencieuse serait pire.

## L’identité signée

Le logiciel hôte sait déjà qui est là. Il **signe** une petite identité avec le secret du produit
et la pose sur `window.feedys` ; le widget la recopie dans `x-feedys-identite`, et Feedys la
vérifie ([D-005](../00-Projet/DECISIONS_LOG.md), [D-015](../00-Projet/DECISIONS_LOG.md)).

```
jeton      = <charge base64url> "." <HMAC-SHA256(secret, charge base64url) base64url>
charge     = { "ref": "u-4218", "nom": "Camille Dupont", "role": "gestionnaire", "exp": 1789000000 }
```

`ref` et `exp` sont exigés ; `nom` et `role` sont facultatifs — un hôte qui ne connaît pas le rôle
de quelqu’un ne doit pas être obligé d’en inventer un. `exp` est en **secondes**.

⛔ **AUCUN verdict d’identité ne refuse un retour.** Absent, expiré, forgé, illisible, produit sans
secret utilisable : le retour est **accepté**, `identite_verifiee` vaut `false`, et les trois
`auteur_*` restent vides. On ne perd jamais une parole pour un problème d’identité.

⛔ **Un verdict négatif n’écrit rien du tout**, pas même le `ref` que le jeton prétendait porter.
Une identité non vérifiée n’est pas une identité dégradée, c’est une absence d’identité.

⛔ **Le motif du refus ne sort jamais dans la réponse.** Dire à qui poste que sa signature est
fausse plutôt qu’expirée l’aide à forger. Il est journalisé, et c’est tout — le widget, lui, reçoit
un `201` comme d’habitude et n’a rien à en faire.

⚠️ **La signature est vérifiée AVANT que la charge ne soit analysée.** L’ordre inverse reviendrait
à faire confiance à ce que n’importe qui a écrit dans un en-tête.

⚠️ **Ce n’est pas un JWT, délibérément** : un seul algorithme, écrit dans le code des deux côtés,
et rien à lire dans le jeton pour savoir comment le vérifier. Comment signer côté hôte : README
§Attacher une identité.

## La sécurité, en pratique

⚠️ **La clé publique est publique** — elle est dans le HTML de l’hôte, et
[architecture.md](../04-Architecture/architecture.md) §Sécurité l’assume. Le pire cas visé n’est
pas la fuite, c’est le bruit.

- **Débit** limité par clé **et** par IP : la clé borne un produit qui s’emballe, l’IP borne
  quelqu’un qui s’amuse avec une clé trouvée dans un HTML. En mémoire, pas de Redis — un
  redémarrage remet les compteurs à zéro, et ce n’est pas grave.
- **Origine** vérifiée contre le `domaine` du produit. Le schéma et le port sont ignorés (le même
  logiciel se sert en `:3000` sur un poste et en `:443` en production) ; ⛔ aucun joker de
  sous-domaine. Une requête **sans** `Origin` passe : ce n’est pas un navigateur, et CORS protège
  l’onglet de quelqu’un, pas l’API.
- **L’IP ne sert qu’à compter.** Elle n’est ni stockée, ni journalisée, ni attachée au retour.
- **Rien de la parole ne sort en console.** Les journaux d’un conteneur ne sont pas un endroit où
  ranger ce que quelqu’un a dit.

## Créer un produit

```bash
pnpm produit:creer -- --nom "VictorIA" --domaine victoria.exemple.fr
```

Imprime la clé publique et le secret **une fois**. ⛔ Le secret n’est stocké qu’en argon2id
([D-010](../00-Projet/DECISIONS_LOG.md)) : rien ne peut le réafficher. Il vit sur le **serveur**
de l’hôte, qui s’en servira pour signer l’identité du collaborateur (P-012) — jamais dans le
navigateur, jamais dans une page.

## Ce que P-003 ne fait pas

- **L’entretien** — le port `aval` est déclaré et jamais fourni (P-007).
- **La transcription serveur** — l’audio est rangé, pas encore lu.
