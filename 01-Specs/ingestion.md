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
    "capture": { "type": "image/webp", "donnees": "<base64>" }
  }
}
```

⛔ **`texte` OU `audio` — au moins l’un des deux.** Le serveur ne suppose **jamais** que la
transcription s’est faite chez le client : c’est ce qui ouvrira Whisper le jour où Chrome n’est
plus tenable, sans réécriture ni migration.

⛔ **Les deux listes de champs sont closes**, et le schéma refuse tout champ inconnu. La liste du
contexte est celle de [widget.md](widget.md) §Ce que le widget joint tout seul, mot pour mot. Le
dépôt est public : elle doit pouvoir être lue par n’importe qui sans gêne.

⚠️ **`source` est déclaré par le widget**, parce qu’un transcript Web Speech est de la voix **sans
fichier audio** — le serveur ne peut pas le deviner. Avec un audio, il vaut `voix` quoi qu’il
arrive. Ce n’est pas décoratif : c’est la mesure du pari du produit.

⚠️ **`horodatage` est indicatif.** `cree_le` fait foi, posé par la base : une horloge de poste peut
être fausse de plusieurs heures.

## Les réponses

| Code | Motif | Quand |
|---|---|---|
| `201` | — | `{ "retour": "<id>" }` — les trois lignes sont écrites |
| `400` | `corps_invalide` | JSON illisible, champ inconnu, ni texte ni audio, borne dépassée |
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

## Ce qui est écrit, et où

Trois lignes, **en une transaction** — elles partent ensemble ou pas du tout. Un retour sans son
message serait une parole perdue avec l’air d’avoir été reçue.

| Table | Ce qui y va |
|---|---|
| `retours` | `produit_id`, `source`, `statut = 'en_cours'`, `identite_verifiee = false` (P-012) |
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

- **L’identité signée** — `identite_verifiee` reste `false` et `auteur_*` reste vide (P-012).
- **L’entretien** — le port `aval` est déclaré et jamais fourni (P-007).
- **La transcription serveur** — l’audio est rangé, pas encore lu.
