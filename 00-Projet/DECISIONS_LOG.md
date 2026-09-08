# Journal des décisions

Une entrée par décision structurante : ce qui a été tranché, **pourquoi**, et ce qui la
renverserait. Les décisions ne se réécrivent pas — une décision annulée reçoit une nouvelle
entrée qui la remplace, et l’ancienne reste, barrée.

---

## D-001 — Dépôt public, AGPL-3.0 au serveur, MIT au widget et au MCP

**2026-09-04**

Feedys est publié en open source. Le serveur est sous **AGPL-3.0** ; `packages/widget` et
`packages/mcp` sous **MIT**.

**Pourquoi cette découpe et pas une licence unique.** Le widget s’exécute dans la page de
logiciels métier qui, eux, ne sont pas libres. Si le widget était AGPL et se retrouvait empaqueté
dans le bundle de l’hôte, **le logiciel hôte deviendrait une œuvre dérivée AGPL** — c’est-à-dire
que son propriétaire pourrait en exiger et en redistribuer le code source. Inacceptable, et
silencieux : rien n’avertit au moment du `pnpm add`.

Deux mesures rendent la frontière tenable : le widget est **MIT**, et il ne s’intègre **que par
`<script src>`**, jamais en dépendance npm empaquetée par l’hôte.

**Pourquoi AGPL et pas MIT partout.** L’AGPL protège le seul actif qui compte ici : le travail. Un
tiers peut s’en servir, le modifier, le vendre même — mais s’il l’expose sur le réseau, il rend ses
modifications. C’est un échange équitable, et il ne coûte rien à un projet dont l’auteur ne vend
rien.

**Ce qui la renverserait** : vouloir que Feedys soit adopté par des sociétés qui refusent l’AGPL
par principe. On passerait alors à Apache-2.0 — décision à prendre **avant** le premier
contributeur externe, parce qu’après, il faut l’accord de chacun.

*Découpe empruntée à [FasterFixes](https://github.com/manucoffin/faster-fixes), qui résout le même
problème de la même façon.*

---

## D-002 — Le widget est écrit, pas emprunté à `deep-chat`

**2026-09-04**

Deux montages avaient été instruits. Le montage retenu est **Preact + composants maison**, pas
l’intégration du web component [`deep-chat`](https://github.com/OvidijusParsiunas/deep-chat).

**Pourquoi c’est contre-intuitif.** `deep-chat` (MIT, 3 708 ★) est un excellent projet qui couvre
d’un coup le fil de conversation, l’embarquement multi-stack **et** la dictée par Web Speech, avec
arrêt automatique sur silence. Il aurait fait gagner une semaine.

**Pourquoi on ne le prend quand même pas.** La dictée n’est pas une fonctionnalité de Feedys,
c’est **son geste central et son seul différenciateur**. Or `deep-chat` impose son geste : un
bouton micro qu’on arme et qu’on désarme. Le geste juste est celui de la note vocale — appuyer,
l’onde qui monte, relâcher, glisser pour annuler — que tout le monde connaît déjà sans
l’apprendre. Hériter de l’UX vocale d’un autre projet sur le seul écran qui fait le produit est
un mauvais échange, même contre une semaine.

S’ajoute que l’état « le bot a compris ça » (voir [01-Specs/entretien.md]) n’est pas un message de
chat mais une **carte corrigeable en place** — ce que l’architecture interne de `deep-chat` rend
pénible.

**Ce qu’on lui prend quand même** : [`speech-to-element`](https://github.com/OvidijusParsiunas/speech-to-element),
son moteur de dictée extrait en bibliothèque autonome, MIT, du même auteur. On obtient l’enrobage
Web Speech éprouvé sans le composant qui l’entoure.

**Ce qui la renverserait** : constater à la recette que la dictée maison est moins fiable que
celle de `deep-chat` sur des cas réels. Le repli est peu coûteux — `speech-to-element` est déjà
la couche commune.

---

## D-003 — Web Speech API, Chrome et Edge requis

**2026-09-04**

La dictée passe par l’**API Web Speech du navigateur**. Gratuite, sans clé, sans quota.
Conséquence assumée : **Chrome ou Edge obligatoires** pour dicter. Firefox ne l’implémente pas et
le chantier est fermé chez Mozilla ; Safari est irrégulier, surtout en WebView.

**Ce qui rend le choix supportable** :

- le champ texte est **toujours là**, au même niveau de visibilité que le micro. Sur un navigateur
  sans dictée, le widget ne se casse pas et ne s’excuse pas : il montre le champ, sans mentionner
  ce qui manque ;
- ⛔ **l’API d’ingestion accepte un transcript OU un fichier audio dès le premier jour.** Le
  serveur ne suppose jamais que la transcription s’est faite chez le client. Ça ne coûte rien
  aujourd’hui et ça ouvre Whisper sans réécriture ni migration.

**Ce qu’on sait et qu’on accepte** : dans Chrome, l’audio part chez Google pour être transcrit.
Chrome 139+ propose `processLocally` (modèle SODA sur la machine, rien ne sort) — à activer quand
`SpeechRecognition.available({ langs: ['fr-FR'], processLocally: true })` répond favorablement.
À vérifier, pas à supposer.

**Ce qui la renverserait** : un utilisateur qui ne peut pas quitter Firefox, ou une exigence de
confidentialité qui interdit l’envoi d’audio à un tiers. Le repli est prêt par construction :
`MediaRecorder` (universel) + Whisper côté serveur.

---

## D-004 — Monorepo pnpm + Turborepo, Next.js au serveur, Preact au widget

**2026-09-04**

| Couche | Choix | Motif |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | trois paquets aux licences différentes, dans un seul dépôt : c’est la frontière de D-001 qui l’exige |
| Serveur + back-office | Next.js 16 | stack déjà maîtrisée, une seule chose à déployer |
| Widget | **Preact** + Vite | 3 Ko contre 130 Ko. Le widget s’injecte dans la page d’autrui : la taille est un argument de conception, pas une optimisation |
| Base | PostgreSQL + Prisma, migrations SQL brutes | `prisma migrate` n’est jamais utilisé ; `db/migrations/*.sql` fait foi |
| Modèle | Vercel AI SDK + Claude | `generateObject` rend une synthèse **typée**, pas du texte à reparser |

**Pourquoi Preact et pas React malgré la friction.** Un widget tiers qui ajoute 130 Ko à une page
qui ne lui appartient pas est un widget qu’on finit par retirer. Preact a la même API. La friction
réelle est ailleurs : les composants `shadcn` sont React + Tailwind, donc ils **ne servent pas au
widget** — ils serviront au back-office, où React est déjà là.

---

## D-005 — Un produit, une clé. Pas de compte utilisateur dans Feedys

**2026-09-04**

Chaque logiciel métier est un **produit** dans Feedys, identifié par une **clé publique**
(`fdy_pub_…`, dans la balise `<script>`, visible de tous) et un **secret** (côté serveur de
l’hôte, jamais dans le navigateur).

⛔ **Les collaborateurs n’ont pas de compte Feedys, ne s’inscrivent pas, ne se connectent pas.**
Le logiciel hôte sait déjà qui ils sont : il **signe** une petite identité avec son secret et la
passe au widget au démarrage. Feedys la vérifie et l’attache au retour.

**Pourquoi ce détour plutôt qu’un simple champ « votre nom ».** Un champ nom déclaratif est à la
fois une friction (une question de plus) et un mensonge possible. La signature donne une identité
**vraie et gratuite** — le collaborateur ne fait rien.

**Pourquoi pas d’authentification du tout, alors ?** Parce qu’un retour anonyme est presque
inutile : on ne peut pas revenir vers la personne, ni pondérer selon son métier. C’est le
minimum d’identité pour que le produit serve, et pas un octet de plus.

⚠️ **Ce n’est pas du multi-tenant.** Une instance, un développeur, plusieurs de ses produits. Il
n’y a pas de clients, pas d’organisations, pas d’isolation à prouver à un tiers.

---

## D-006 — Deux relances au maximum, puis on envoie

**2026-09-04**

Le bot pose **au plus deux relances**. Ensuite il envoie ce qu’il a, en **déclarant explicitement
ce qui manque** dans la note.

**Pourquoi une limite dure plutôt qu’un critère de complétude.** Un modèle à qui on demande de
« continuer jusqu’à ce que ce soit clair » ne s’arrête jamais : il y a toujours une précision de
plus à obtenir. Et un entretien qui dure est un widget qu’on n’ouvre plus jamais — le coût qu’on
prétendait supprimer revient par la porte de derrière.

Une note incomplète mais **honnête sur ses trous** vaut mieux qu’une note complète que personne
n’a eu la patience de finir. C’est à ça que servent les champs `confiance` et `questions_ouvertes`
de la synthèse.

**Ce qui la renverserait** : constater que les notes à deux relances sont systématiquement
inexploitables. On agirait alors sur **la qualité des questions**, pas sur leur nombre.

---

## D-007 — La note part par email, et le MCP l’expose. Slack plus tard

**2026-09-04**

Au MVP, la synthèse arrive par **un email** et par le **serveur MCP**. Pas de Slack, pas de
webhook, pas d’intégration GitHub.

**Pourquoi ces deux-là.** L’email est le seul canal qui marche partout sans configuration et qui
survit à tout. Le MCP est le canal qui compte vraiment : il met le retour **là où le travail se
fait**, dans l’éditeur, à côté du code concerné.

Les autres canaux sont des variations sur le même contenu. Ils s’ajouteront quand la note aura
prouvé qu’elle est bonne — l’ajouter tôt ne ferait que multiplier les endroits à corriger à chaque
changement de format.

---

## D-008 — TypeScript 6, pas 7, tant que `typescript-eslint` ne suit pas

**2026-09-04**

TypeScript 7 (le portage natif) est publié et c’est la version `latest` de npm. On reste
volontairement sur **TypeScript 6.0.3**.

**Le motif est unique et vérifiable** : `typescript-eslint@8.69.0` déclare
`typescript: '>=4.8.4 <6.1.0'`. Or c’est lui qui parse le TypeScript pour ESLint, et donc **lui qui
fait tenir la frontière de licence** — la règle `no-restricted-imports` ne voit rien dans un
fichier qu’aucun parseur n’a lu.

⚠️ Prendre TS 7 aujourd’hui, c’est troquer une amélioration de vitesse de compilation contre le
seul garde-fou de l’invariant le plus fragile du projet ([licences.md]). Le troc est mauvais.

**Ce qui la renverserait** : une version de `typescript-eslint` qui accepte `typescript@^7`. Le
jour où c’est le cas, la migration est un changement de numéro dans quatre `package.json`.

---

## D-009 — Le rôle applicatif n’est pas propriétaire de ses tables

**2026-09-04**

`0001_socle.sql` crée un rôle de **groupe** `feedys_app`, sans connexion propre, et lui accorde
`SELECT, INSERT, UPDATE` sur les six tables métier, `SELECT, INSERT` sur `audit`, et ⛔ **aucun
`DELETE` nulle part**.

⚠️ **Cette précaution ne vaut que si `DATABASE_URL` n’est pas le propriétaire des tables.** Un
propriétaire contourne tous les `GRANT` : la zone gelée serait modifiable, la parole effaçable, et
**rien ne le signalerait** — pas une erreur, pas un test rouge. C’est exactement le mode de
défaillance silencieuse qu’on cherche à éviter.

En production, `DATABASE_URL` utilise donc un rôle de login **membre de `feedys_app`**, distinct
du rôle qui applique les migrations.

**Pourquoi des privilèges plutôt qu’une règle de code.** Une règle de code ne protège que le code
qui la respecte. Le jour où quelqu’un ouvre `psql` avec les identifiants de l’application pour
« corriger vite fait une typo dans un message », c’est Postgres qui doit dire non.

**Ce qui la renverserait** : rien de connu. L’ouverture d’un `DELETE` se ferait table par table,
avec sa justification écrite dans la migration qui l’ouvre.

---

## D-010 — argon2 en WebAssembly, pas en extension native

**2026-09-04**

Le secret d’un produit est haché en **argon2id via `hash-wasm`** (MIT), et non via `argon2`
(node-gyp) ni `@node-rs/argon2` (binaire natif préconstruit).

**Le motif est le conteneur.** L’image de production est une Alpine minuscule
([hebergement.md](../04-Architecture/hebergement.md)). Une extension native y impose soit une
chaîne de compilation complète dans l’étape de construction, soit un binaire préconstruit qu’il
faut faire exister pour `linux-x64-musl` en plus de `linux-x64-gnu`, `darwin-arm64` et
`win32-x64` — quatre cibles à tenir pour **trois appels par an**. Un produit se crée à la main,
et son secret se vérifie une fois par requête d’identité signée (P-012), pas une fois par retour.

**Le coût est mesuré et accepté** : WebAssembly est environ deux fois plus lent que le natif sur
argon2. À ce volume, la différence est de quelques dizaines de millisecondes par an.

⚠️ Les paramètres (19 Mio, 2 passes, 1 fil) sont **écrits dans l’empreinte produite** —
`$argon2id$v=19$m=…,t=…,p=…`. Les durcir plus tard ne casse donc aucun secret déjà haché : la
vérification relit les paramètres de chaque empreinte.

**Ce qui la renverserait** : un usage qui vérifierait un secret à chaque retour plutôt qu’à chaque
ouverture de session hôte. Ce n’est pas la forme de D-005, et rien ne l’annonce.

---

## D-011 — snapdom est servi par Feedys, pas empaqueté dans le widget

**2026-09-04**

`@zumer/snapdom` **n’entre pas dans `widget.js`**. Il est servi par le conteneur Feedys sous
`/snapdom.js` et chargé par le widget **à la demande**, à l’ouverture du panneau.

**Le motif est une mesure, pas une intuition.** Le 2026-09-04, `dist/snapdom.mjs` de la version
2.24.15 pèse **52 Ko gzip**. Le budget total de `widget.js` est de **60 Ko gzip**
([widget.md](../01-Specs/widget.md) §4). L’empaqueter laisserait 8 Ko pour Preact, la coquille, la
dictée, l’onde et le fil d’entretien — c’est-à-dire pour tout le produit.

⚠️ Le budget avait été posé sans cette mesure : [dependances.md](../04-Architecture/dependances.md)
retenait snapdom sur sa vitesse et sa fraîcheur, pas sur son poids. La règle du dépôt est qu’un
dépassement se tranche explicitement, jamais par glissement — c’est ce que fait cette entrée.

**Pourquoi ça ne coûte rien.** La capture est prise **à l’ouverture du panneau**, jamais au
chargement de la page. Charger 52 Ko à ce moment-là ne ralentit pas l’hôte : le collaborateur
vient de cliquer, il regarde un panneau s’ouvrir, et la capture n’est de toute façon pas ce qu’il
attend. ⚠️ Et si le chargement échoue, la capture est simplement absente — l’échec doux était déjà
la règle.

⛔ **Depuis l’origine Feedys, jamais depuis un CDN.** Le widget s’exécute dans le logiciel de
quelqu’un d’autre : lui imposer un tiers au moment de l’exécution, et la règle CSP qui va avec,
n’est pas à nous de le décider. C’est le même raisonnement que [D-001] sur `<script src>`.

⚠️ **Ce que P-005 doit faire** : servir `/snapdom.js` à côté de `/widget.js`, et appeler
`definirOrigineFeedys()` avec l’origine du `<script src>` qui a chargé le widget. Sans ça, la
capture ne se déclenche jamais — silencieusement, par construction.

**Ce qui la renverserait** : une version de snapdom qui descendrait sous ~15 Ko gzip, ou un
navigateur qui rendrait la capture native. Ni l’une ni l’autre n’est annoncée.

**Pourquoi pas un `import()` dynamique plutôt qu’une balise `<script>`** : le widget est construit
en IIFE d’un seul fichier, parce que l’intégration supportée est un `<script src>` classique sans
`type="module"` ([D-001]). Vite y **replie** les imports dynamiques dans le même fichier — le
découpage n’aurait donc pas lieu.

---

## D-012 — `@ricky0123/vad` n’entre pas dans Feedys : l’arrêt sur silence est calculé

**2026-09-04**

Le mode mains libres s’arrête après **deux secondes de silence**. Ce silence est détecté depuis
l’**`AnalyserNode`** qu’on ouvre de toute façon pour dessiner l’onde, et **pas** par le modèle
Silero de `@ricky0123/vad`, que [dependances.md](../04-Architecture/dependances.md) avait retenu.

**Le motif est une mesure, pas une intuition.** Relevé le 2026-09-04, pour la chaîne minimale
servie depuis l’origine Feedys, en gzip :

| Fichier | gzip |
|---|---|
| `ort-wasm-simd-threaded.wasm` | **3,4 Mo** |
| `silero_vad_v5.onnx` | **1,9 Mo** |
| `@ricky0123/vad-web` `bundle.min.js` | 20 Ko |
| `ort.wasm.min.js` + son glu `.mjs` | 25 Ko |
| **Total** | **≈ 5,3 Mo** |

Le widget entier pèse **24 Ko gzip**. Silero coûterait **220 fois** le produit, pour décider qu’on
s’est tu.

⛔ **Et le poids n’est même pas l’argument décisif — le MOMENT l’est.** Ces 5,3 Mo se
téléchargeraient à l’instant précis où quelqu’un vient de cliquer pour parler, dans le logiciel
métier de quelqu’un d’autre, sur une liaison d’entreprise. Il parlerait pendant le chargement, et
on perdrait ce qu’il dit. Charger à la demande ne résout donc pas le problème : **c’est la demande
qui est le mauvais moment.** Le charger plus tôt reviendrait à imposer 5,3 Mo à l’hôte au
chargement de sa page, ce que [D-011] a déjà refusé pour 52 Ko.

⚠️ **C’est l’alternative que [T-001](TICKETS_DIFFERES.md) avait elle-même prévue** — « un simple
seuil d’énergie sur l’`AnalyserNode` : moins bon, mais gratuit et déjà présent pour dessiner
l’onde ». Ce ticket est donc clos par cette entrée.

**Ce qu’on fait à la place, et pourquoi ce n’est pas un seuil fixe.** Un seuil absolu tient dans un
bureau silencieux et échoue exactement là où le produit vit : en open space, où le bruit de fond
passerait pour de la parole et où l’arrêt n’arriverait jamais. Le plancher est donc **mesuré** sur
les 400 premières millisecondes de l’écoute, puis suivi lentement — et seulement vers le bas.
`packages/widget/src/dictee/silence.ts`, vérifié par un test qui rejoue un open space.

⚠️ **Le biais est assumé, et il va dans un seul sens** : on préfère ne pas s’arrêter que s’arrêter
trop tôt. Un arrêt manqué coûte **un clic** — le second clic est visible en permanence. Un arrêt
prématuré coupe quelqu’un au milieu d’une phrase, et il ne recommencera pas.

**Ce qui la renverserait** : un modèle de VAD sous ~200 Ko, ou une API `VoiceActivityDetection`
native au navigateur. ⚠️ Ou, plus probablement, l’observation que l’arrêt automatique se trompe
en usage réel — auquel cas la réponse la moins chère reste le second clic, pas cinq mégaoctets.

⛔ **Ce qui ne la renverse PAS** : la qualité supérieure de Silero. Elle n’a jamais été en cause.

---

## D-013 — La carte de compréhension n’est pas stockée. Le fil l’est.

**2026-09-04**

L’entretien produit à chaque tour une **carte de compréhension** — type, titre, résumé, écran,
récurrence. Elle est rendue au widget, corrigée là, et **elle n’est écrite dans aucune colonne**.
Ce qui est écrit, c’est le **fil** : ce que la personne a dit, les questions du bot, et les
corrections qu’elle a faites, chacune sous forme d’une ligne `collaborateur` préfixée
`Correction · `.

**Pourquoi ne pas la stocker, alors qu’on la calcule.** Trois raisons, et la troisième suffirait.

1. **Le schéma n’a pas de place pour elle, et c’était voulu.** `0001_socle.sql` a été écrit en
   sachant que P-007 et P-008 venaient : il donne à `messages` un `texte` immuable et un `motif`,
   et il donne à `syntheses` un `contenu` jsonb. La carte est un état intermédiaire, pas un
   livrable ; lui ouvrir une colonne reviendrait à faire du `jsonb` un fourre-tout, ce que
   [conventions-db.md](../04-Architecture/conventions-db.md) interdit.
2. **Elle est recalculable, et la synthèse la recalcule.** À la fin de l’entretien,
   `generateObject` relit le fil entier et produit la structure qui compte. Stocker en plus une
   compréhension intermédiaire, c’est se donner deux vérités et le devoir de les réconcilier.
3. ⛔ **Une correction est de la parole, pas un diff.** « non, c’est l’écran d’à côté » est
   quelque chose que quelqu’un a dit. En faire une ligne du fil est plus vrai qu’un `UPDATE` sur
   une carte — et ça la rend immuable, comme le reste de ce qui a été dit
   ([conventions-db.md](../04-Architecture/conventions-db.md) §Ce qu’on n’efface pas).

**La conséquence qu’il faut connaître.** Une ligne `bot` n’est écrite **que si le bot a posé une
question**. C’est ce qui rend le compte des relances exact et non interprétable — et donc ce qui
rend la troisième relance impossible côté serveur, sur le fil en base plutôt que sur un compteur
qu’un client pourrait forger ([D-006]).

**Ce qui la renverserait** : un back-office qui voudrait montrer « ce que le bot avait compris à
chaque tour » plutôt que ce qui a été dit. On ajouterait alors une colonne à `messages`, avec sa
migration et sa justification — pas un `jsonb` fourre-tout.

---

## D-014 — Le verbatim est garanti par le serveur, pas demandé au modèle

**2026-09-04**

Les `citations` d’une synthèse sont **remplacées** par la tranche exacte du message d’origine, et
celles qu’on ne retrouve pas sont **jetées**. `domaine/synthese/verbatim.ts`.

**Pourquoi ne pas simplement le demander au prompt.** On le demande aussi — c’est écrit noir sur
blanc dans `synthese.md`. Mais une consigne de prompt n’est pas une garantie : elle tient la
plupart du temps, elle lâche sans prévenir, et **elle lâche silencieusement**. Une citation
reformulée ressemble exactement à une citation exacte. Personne ne la remarquerait, et le champ qui
fait la valeur de la note deviendrait un résumé de plus.

C’est le même raisonnement que la limite de deux relances ([D-006], [D-013]) : ce qui doit être
vrai est tenu par le code, pas par la docilité du modèle.

**Le détail qui fait que ça marche.** La recherche est tolérante aux blancs et à la casse ; **ce
qu’on garde est découpé dans le texte d’origine**. Un modèle recopie fidèlement mais re-ponctue les
blancs et met une majuscule au premier mot ; refuser sur ce motif jetterait la quasi-totalité des
citations d’un transcript dicté, et on perdrait exactement ce qu’on voulait protéger. La tolérance
porte sur la RECHERCHE, jamais sur le résultat.

**La même logique, sur `confiance`.** Le serveur la plafonne à `basse` dans deux cas et deux
seulement — **l’abandon** et **aucune citation retenue** — parce que ni l’un ni l’autre ne se lit
dans le fil. Le reste (transcript pauvre, reformulation non confirmée) est laissé au prompt : ça se
lit dans le fil, et le modèle le lit mieux qu’une règle.

⚠️ **On ne plafonne PAS sur « deux relances atteintes »**, malgré la lettre de [01-Specs/synthese.md].
Le fait est **dit** au modèle, qui reste libre d’écrire « moyenne » : un entretien peut aller au
bout de ses deux questions et être riche. Une règle mécanique y ferait mentir la confiance dans
l’autre sens, ce qui est le même défaut.

**Ce qui la renverserait** : un relevé montrant que les citations jetées sont majoritairement des
citations correctes que la recherche rate. On élargirait alors la normalisation — jamais le
résultat.

---

## D-015 — Le secret d’un produit est aussi stocké chiffré, parce qu’un HMAC se vérifie avec sa clé

**2026-09-04**

Le serveur de l’hôte signe l’identité du collaborateur avec le secret du produit ([D-005]) ; Feedys
recalcule ce HMAC pour la vérifier. **Vérifier un HMAC demande la clé qui a signé, pas son
empreinte.** Un argon2 ne s’inverse pas : `secret_hash` ne pouvait donc pas servir à ça, et il n’y
avait pas de troisième voie — un MAC symétrique n’a pas de « clé publique de vérification ».

D’où une seconde colonne, `produits.secret_chiffre` : le secret **chiffré en AES-256-GCM** sous
`FEEDYS_CLE_CHIFFREMENT`, une clé de 32 octets qui vit dans l’environnement du conteneur et
**jamais en base**.

**Ce que ça protège, précisément.** [hebergement.md](../04-Architecture/hebergement.md) garde
trente jours de dumps Postgres, et un dump voyage — vers une sauvegarde, un poste, un disque. Avec
le secret en clair dans la table, quiconque tient un vieux dump peut signer l’identité de n’importe
qui, indéfiniment. Avec la colonne chiffrée, un dump seul ne suffit pas : il faut aussi
l’environnement du conteneur.

⚠️ **Les deux colonnes ne font pas double emploi.** `secret_hash` est une **preuve** — « c’est bien
ce secret-là », et elle ne s’inverse pas. `secret_chiffre` est une **clé** — de quoi recalculer une
signature. Confondre les deux est exactement l’erreur que cette entrée existe pour éviter.

⚠️ **Ce que ça corrige de [D-010].** D-010 décrivait un secret « vérifié une fois par requête
d’identité signée ». C’était une lecture optimiste : rien ne vérifie le secret à l’ingestion, on
recalcule une signature. Le motif de D-010 — pas d’extension native dans une image Alpine — reste
entier, et argon2id reste le bon outil pour la preuve.

⛔ **Sans la clé, `pnpm produit:creer` refuse de créer le produit.** Un produit sans
`secret_chiffre` accepterait tous ses retours en `identite_verifiee = false` sans que rien ne le
dise — la panne silencieuse que ce dépôt refuse partout ailleurs. Un produit **déjà** créé sans
elle, lui, continue de fonctionner : ses retours arrivent, simplement sans auteur.

⛔ **Et le jeton n’est pas un JWT.** Un JWT porte son algorithme dans sa propre en-tête, et toute la
famille de failles « `alg: none` » vient de là : le vérificateur lit dans le jeton comment le
vérifier. Le format de Feedys est `<charge base64url>.<HMAC-SHA256 base64url>` — un seul algorithme,
écrit dans le code des deux côtés, rien à lire. Le coût pour l’hôte est de huit lignes de
`node:crypto` et aucune dépendance (README §Attacher une identité).

**Ce qui la renverserait** : un besoin de vérifier une identité **sans pouvoir la forger** — par
exemple si Feedys devenait un service partagé entre plusieurs organisations. Il faudrait alors des
signatures asymétriques (Ed25519), l’hôte gardant sa clé privée et Feedys ne stockant que la
publique. Ce n’est pas la forme de D-005, qui décrit une instance, un développeur, ses produits.

---

## D-016 — Le démarrage vit dans `instrumentation.ts`, pas dans un script d’entrée

**2026-09-04**

Les six étapes du démarrage — variables, base, migrations, empreintes, widget, écoute
([hebergement.md](../04-Architecture/hebergement.md)) — tournent dans le hook `register()` de
Next, et non dans un script lancé avant le serveur.

**Le motif est l’image.** Elle porte le serveur autonome de Next (`output: 'standalone'`) : ni
`pnpm`, ni `tsx`, ni la hiérarchie du dépôt, ni `node_modules` complet — c’est ce qui la tient à
~320 Mo. Un script d’entrée écrit en TypeScript aurait donc demandé **un second empaquetage**
(esbuild, ou une compilation à part) uniquement pour appliquer des migrations. `register()` est
appelé par Next lui-même au bootstrap et voit tout le code de l’application : le runner de
migrations, la lecture du widget, les contrôles. Zéro dépendance de plus.

⛔ **Un échec tue le processus** (`process.exit(1)`). Un serveur à moitié démarré qui répond 500 à
tout est pire qu’un conteneur qui redémarre en boucle sous les yeux de l’exploitant — le second se
voit, le premier se découvre chez les hôtes.

⚠️ **Sur un poste, les mêmes contrôles n’avertissent que.** `pnpm dev` doit démarrer sans Postgres,
sans clé de modèle et sans widget construit ; hebergement.md dit déjà de l’étape 5 qu’elle est « un
garde-fou de production, pas un test ». La bascule est `NODE_ENV`.

**Ce qu’on accepte en échange.** Next imprime son « Ready » avant que `register()` n’ait fini : la
ligne apparaît, puis les contrôles parlent, puis le processus sert ou meurt. C’est cosmétiquement
regrettable et sans conséquence — Next n’exécute aucun code de requête avant que le hook ne soit
résolu, et un refus tue le processus en quelques centaines de millisecondes.

**Ce qui la renverserait** : un besoin de migrer **sans** démarrer le serveur — un job de
déploiement séparé, par exemple. `pnpm db:migrate` couvre déjà ce cas sur un poste ; en conteneur,
il faudrait alors le second empaquetage qu’on a évité ici.

---

## D-017 — L’arrêt sur silence attend cinq secondes, pas deux

**Prise le** : 2026-09-05, pendant P-015, après la première dictée réelle
**Statut** : appliquée

### Le contexte

[D-012](DECISIONS_LOG.md) a tranché *comment* détecter le silence — un plancher mesuré sur
l’`AnalyserNode`, jamais un seuil fixe. Il n’a pas tranché *combien de temps* attendre : deux
secondes ont été posées par défaut, sans mesure, avant que quiconque ait dicté un vrai retour.

### Ce qu’on a constaté

La première dictée à la voix, jouée par un humain dans Chrome : **« ça se coupe si on marque un
temps de pause »**. Pas au milieu d’un mot — au milieu d’une réflexion.

⚠️ Et c’est le cas ordinaire, pas le cas limite. Quelqu’un qui décrit un problème qu’il vient de
rencontrer reconstitue en parlant : « alors, quand je clique sur… euh… le bouton suivant ». Deux
secondes de silence sont un temps de réflexion, pas une fin de phrase.

### La décision

`APRES_MS` passe de **2 000 à 5 000 ms**.

### Pourquoi cinq, et pas trois ni dix

Le module `dictee/silence.ts` déclarait déjà l’asymétrie, en toutes lettres :

> Un arrêt manqué coûte un clic — le second clic est visible en permanence. Un arrêt prématuré
> coupe quelqu’un au milieu d’une phrase, et il ne recommencera pas.

⛔ **La valeur ne respectait pas le principe écrit juste au-dessus d’elle.** Cinq secondes le
respectent : c’est assez long pour couvrir une hésitation ordinaire, assez court pour que celui
qui a fini n’ait pas l’impression que rien ne se passe. Au-delà de dix, l’écran « j’écoute »
donnerait le sentiment d’être resté allumé pour rien.

⚠️ **Le coût du côté long est nul ou presque** : qui a fini de parler n’attend pas — « Envoyer
maintenant » et le second clic sont visibles en permanence, et c’est précisément pour ça qu’ils le
sont.

### Ce qu’on n’a pas fait

⛔ **Rendre le délai configurable par l’hôte.** Un réglage de plus à comprendre pour chaque
intégration, alors que personne n’a de raison de le changer. Si un jour un hôte le demande, ce
sera une décision, pas une option ajoutée en passant.

⛔ **Détecter la fin de phrase par le modèle.** Il faudrait un aller-retour réseau à chaque pause,
sur le seul écran où la latence se voit.

---

## D-018 — Le filet tourne dans le processus, et N vaut trente minutes

**Prise le** : 2026-09-05, pendant P-016
**Statut** : appliquée

### Le contexte

La clôture d’un entretien dépendait entièrement du navigateur. Un onglet tué et le retour restait
`en_cours` pour toujours — ni synthèse, ni email ([BUGS_LOG](../03-Bugs/BUGS_LOG.md) 003, T-006).
Deux choses étaient à trancher : **où** un balayage périodique peut tourner, et **au bout de
combien de temps** un entretien est réputé mort.

### Où il tourne — `setInterval`, dans le processus qui sert les requêtes

[hebergement.md](../04-Architecture/hebergement.md) §Ce qui n’est pas là refuse une file, un worker
et un cache ; §La forme interdit qu’un mécanisme dépende du planificateur d’un hébergeur — le
conteneur doit se déplacer d’un `docker run` à un autre sans que rien ne change. Il ne reste que le
processus lui-même, démarré depuis `instrumentation.ts` comme le reste ([D-016](DECISIONS_LOG.md)).

⚠️ **C’est tenable parce que le travail est minuscule** : une passe est bornée à vingt retours,
toutes les cinq minutes, et ne fait rien la plupart du temps.

⛔ **Deux conteneurs derrière un proxy ne doublent pas les notes.** La réservation est un seul
`update ... where statut = 'en_cours' returning id`, précédé d’un `for update skip locked` : le
`returning` ne rend que les lignes qu’on a soi-même flippées. Le test d’intégration le prouve, et
il rougit si on retire la réservation — vérifié en la retirant.

### Combien de temps — trente minutes, et ce n’est pas une mesure

T-006 disait de mesurer d’abord. La mesure a été jouée, et **elle a répondu autre chose que ce
qu’on lui demandait** : sur treize retours, dix sont `en_cours`, mais ce sont les artefacts des
cinq tentatives d’injection de P-015, jouées par curl sans qu’aucun `POST /fin` ne soit attendu.
⛔ **Une base de développement ne peut pas dire si le défaut est fréquent en usage réel**, et on ne
lui fait pas dire.

Le second volet, lui, a donné un vrai chiffre : **quand le chemin nominal marche, la clôture arrive
en huit secondes au pire** après le dernier message (0 s, 5 s, 8 s sur les trois retours clos).
C’est ce chiffre qui fixe N : trente minutes sont **225 fois** le signal normal. Un entretien
vivant ne peut pas être pris pour un entretien mort.

⚠️ **Les deux côtés du choix.** Trop court, on coupe la parole de quelqu’un qui cherche ses mots
ou qu’un collègue vient d’interrompre — et sa réponse en cours part à la poubelle. Trop long, la
note arrive le lendemain et l’entretien reste affiché « en cours » au back-office entre-temps.

### Ce qu’on n’a pas fait

⛔ **Auditer aussi les clôtures ordinaires.** Ce serait symétrique, mais ça touche
`terminerEntretien` — donc le chemin nominal — pour un besoin que personne n’a. Comme **rien
d’autre n’écrit dans `audit` à la clôture**, la seule présence d’une ligne `cloture_balayage`
suffit à identifier ce que le filet a rattrapé. C’est exactement la question qu’on se pose.

⛔ **Une colonne `clos_par_balayage_le` sur `retours`.** Plus simple à interroger, mais `audit` est
la zone prévue pour ce genre de trace, et elle est append-only par construction.

⛔ **Réveiller le modèle en parallèle.** L’aval est joué en série : vingt synthèses simultanées
depuis le processus qui sert les requêtes est ce qu’on évite, pas ce qu’on optimise.

### Ce qui la renverserait

Un usage réel qui montrerait que trente minutes est trop long — quelqu’un qui se plaint d’attendre
sa note — ou trop court, ce qui se verrait à des entretiens refermés alors que la personne
répondait encore. ⚠️ Les lignes `cloture_balayage` de `audit` sont ce qui permettra de le dire.

---

## D-019 — Deux URL de base : une pour migrer, une pour servir

**Prise le** : 2026-09-05, pendant P-018
**Statut** : appliquée

### Le contexte

[D-009](DECISIONS_LOG.md) a décidé que « aucun `DELETE` nulle part » serait tenu par les privilèges
Postgres et non par une règle de code : **c’est Postgres qui doit dire non**. Il a aussi écrit la
condition de validité : « cette précaution ne vaut que si `DATABASE_URL` n’est pas le propriétaire
des tables ». Pendant tout le MVP, elle ne l’était pas — le garde-fou était là, **inerte**, et rien
ne le disait (T-004).

### La décision

`DATABASE_URL` porte le rôle qui **sert**, membre de `feedys_app`. `DATABASE_URL_MIGRATIONS` porte
le rôle qui **migre**, le propriétaire. Le démarrage lit la seconde, le pool de l’application lit la
première.

⚠️ **La seconde est facultative, et son repli est la première.** Un poste et la CI n’ont qu’un
rôle, et [D-016](DECISIONS_LOG.md) exige que `pnpm dev` démarre sans rien configurer. C’est le
déploiement qui sépare, pas le dépôt.

⛔ **Mais dès qu’on sépare, elle devient obligatoire** — et ce n’est pas un conseil de prudence,
c’est mesuré : un rôle de service ne peut pas migrer **du tout**, même sur une base déjà à jour.
Le runner commence par un `create table if not exists`, et Postgres vérifie le privilège `CREATE`
sur le schéma **avant** de regarder si la table existe. On pouvait croire le contraire — le test
l’a tranché.

### Pourquoi pas un job de migration séparé

C’est la solution habituelle, et [hebergement.md](../04-Architecture/hebergement.md) §La forme
l’interdit : « aucun mécanisme du logiciel ne peut dépendre du fournisseur d’hébergement », le
conteneur doit se déplacer d’un `docker run` à un autre. [D-016](DECISIONS_LOG.md) ajoute que
l’image n’a **qu’une entrée** : ni `pnpm`, ni `tsx`, ni la hiérarchie du dépôt. Une seconde
variable lue par le même `register()` est la seule forme compatible avec les deux.

### Le contrôle qui va avec, et pourquoi il ne refuse pas

Le démarrage annonce désormais le rôle de service : superutilisateur, propriétaire, hors groupe, ou
séparé. ⛔ **Il n’empêche jamais de démarrer** — un poste est légitimement en rôle unique, et la
CI aussi. Refuser là transformerait une information en panne.

⚠️ La question SQL emploie `pg_has_role(current_user, relowner, 'member')` et non une comparaison
de noms : un rôle **membre du propriétaire** peut faire `set role` vers lui, et contourne donc les
GRANT tout autant. Un contrôle qui ne verrait pas ce cas rassurerait à tort.

### Ce qu’on a découvert en le faisant

⛔ **La table `migrations` ne portait aucun GRANT.** Elle n’est créée par aucune migration — le
runner la pose lui-même — et appartient donc au propriétaire. Or `GET /sante` la lit avec le pool
de service. Séparer les rôles faisait rendre 503 à la sonde, échouer le `HEALTHCHECK` de l’image,
et **redémarrer le conteneur en boucle** — au moment précis où l’on croyait avoir durci le
déploiement. D’où `0003_privilege_registre.sql`.

⚠️ Un mode de défaillance qui n’apparaît qu’au durcissement est le pire des deux mondes.

### Ce qui la renverserait

Un besoin de migrer sans démarrer le serveur — c’est déjà ce que D-016 nommait. Il faudrait alors
le second empaquetage qu’on évite depuis P-013.

---

## D-020 — Contextualisation métier et situationnelle hybride de l’entretien

**2026-09-07**

Le bot de l’entretien doit comprendre le jargon spécifique du logiciel hôte (« bordereau »,
« quittance », « liquidation ») et adapter ses relances à la situation immédiate de l’écran,
sans transformer l’entretien en interrogatoire ni violer la règle d’or : ne jamais demander
ce que le contexte donne déjà.

### La décision

La contextualisation repose sur un **mécanisme hybride** à deux niveaux :

1. **Le volet manuel (le produit) — `produits.contexte_metier text`** :
   Défini à l’enregistrement du produit (`pnpm produit:creer --metier "..."`), il explicite le
   vocabulaire et le glossaire métier du logiciel hôte. Il est immuable à l’échelle du retour et
   persiste en base.
2. **Le volet automatique (l’écran) — `contextes.situation text`** :
   L’application hôte peut déclarer une situation immédiate via un attribut HTML doux sur le
   document : `data-feedys-contexte` sur `body` ou `documentElement` (borné à 120 caractères).
   Le widget le lit passivement sans cookie, sans stockage persistant et sans dépendance npm.
   La valeur est transmise au contrat d’ingestion (`situation`) et stockée avec le contexte.

### Pourquoi cette approche et pas un RAG ou une base vectorielle

⛔ **Aucune base vectorielle, aucun RAG lourd, aucune dépendance externe.**
Un système RAG ajouterait des temps de latence imprévisibles, un coût d’infrastructure disproportionné,
et un risque d’hallucination ou d’injection sur des morceaux de documentation non maîtrisés.
Une injection textuelle directe via la marque `{{metier}}` dans le prompt système du bot et de la
synthèse est immédiate, déterministe, testable unitairement et sans dépendance.

### Le comportement en cas d’absence

Si aucun contexte métier ni situation d’écran n’est renseigné, la marque `{{metier}}` se résout en
chaîne vide et le prompt se replie proprement sur son comportement neutre par défaut, sans rupture.

### Les invariants préservés

- **Plafond de deux relances** : appliqué côté serveur, inchangé ([D-006](DECISIONS_LOG.md)).
- **Une question au plus, deux phrases maximum**.
- **Aucun diagnostic ni promesse**.
- **Citations verbatim strictes** : le vocabulaire métier présent dans la parole est préservé mot pour
  mot et vérifié par `verbatim.ts`.
- **Frontière de licence** : `packages/widget` reste 100 % MIT, aucun type ni code AGPL ne remonte.

### Ce qui la renverserait

Un logiciel métier dont le glossaire dépasserait plusieurs dizaines de kilo-octets ou nécessiterait
une arborescence multi-modules dynamique non résoluble au niveau de l’écran.

---

## D-021 — Le retour au collaborateur in-widget et à sens unique

**2026-09-07**

### Le problème

Sans retour vers celui qui parle, Feedys est un **puits sans fond** : le collaborateur signale des
frictions mais ne sait jamais si elles sont lues ou corrigées. Au bout de deux semaines de silence,
le geste de signalement s’éteint.

Or, Feedys n’a **ni compte utilisateur, ni adresse email de collaborateur** : il ne dispose que du
`{ ref, nom, role }` signé par l’hôte avec le secret du produit ([D-005](DECISIONS_LOG.md)). De plus,
Feedys exclut formellement le support client en direct, les files de discussion et les systèmes de
tickets ([VISION.md](VISION.md), [ROADMAP.md](ROADMAP.md) §Ce qui n’arrivera pas).

### Les alternatives écartées

1. **L’envoi d’un email direct au collaborateur** :
   ⛔ **Rejeté.** Feedys ne possède pas l’adresse email du collaborateur et refuse d’en collecter.
   Exiger l’adresse email détruirait l’anonymat structurel de l’outil, créerait une gestion de données
   personnelles (RGPD) disproportionnée et transformerait Feedys en outil de ticketing externe.
2. **Le webhook vers l’application hôte** :
   ⛔ **Rejeté comme mécanisme principal.** Un webhook déléguerait la notification à l’application hôte.
   Or, la quasi-totalité des logiciels métier hôtes ne disposent pas d’un centre de notifications interne
   prêt à l’emploi pour ce type de message. Cela imposerait des semaines de développement aux équipes
   hôtes avant que la moindre boucle de rétroaction ne fonctionne.

### La décision

La notification s’effectue **directement dans le widget**, de façon discrète, sécurisée et
**strictement à sens unique** :

1. **Adossée à l’identité signée (`auteur_ref`)** :
   Le widget relève les retours traités dont l’accusé attend via `GET /api/retours/collaborateur`,
   authentifié par l’en-tête `x-feedys-identite` signé en HMAC-SHA256 par l’hôte ([D-005](DECISIONS_LOG.md)).
   Si l’identité est absente ou anonyme, la relève rend `[]` silencieusement : rien ne casse.
2. **Une restitution discrète** :
   - Sur le lanceur fermé : une pastille discrète dans le coin supérieur signale une information en
     attente, sans pop-up intempestif ni animation agressive.
   - À l’ouverture du panneau : une carte sobre affiche le titre du retour, le mot court facultatif
     du développeur (ex. « Corrigé dans la version déployée ce matin »), et un bouton unique :
     **« J’ai vu »**.
3. **Un accusé de lecture idempotent** :
   Cliquer sur « J’ai vu » appelle `POST /api/retours/:id/accuse` (qui pose `reponse_lue_le = now()`)
   et retire immédiatement la carte.
   ⛔ **Et l’écriture côté développeur l’est aussi.** Reposer le même statut avec le même mot
   ne réveille personne, et marquer sans fournir de mot n’efface pas celui qui était parti
   ([`sql-statut.ts`](../apps/serveur/infra/base/sql-statut.ts)). Sans cette règle, corriger
   une étiquette six semaines plus tard ressortait la carte à quelqu’un qui avait tourné la
   page — le harcèlement poli que le produit refuse d’être.
4. ⛔ **Strictement à sens unique** :
   Aucun champ texte pour répondre, aucun fil de discussion, aucun bouton de relance. Feedys ne devient
   pas un chat de support. La boucle d’information est fermée : le collaborateur sait que sa parole a
   été entendue et traitée, et le widget reste prêt pour un nouveau signalement.

5. ⛔ **Le retour d’autrui est indiscernable du retour inexistant** :
   `POST /api/retours/:id/accuse` rend le même `404` et le même motif dans les deux cas. Un refus
   distinct ferait de cette route un oracle où n’importe quel collaborateur du produit énumère
   les identifiants de ses collègues — dans un outil dont l’argument est justement qu’on y
   parle librement.

### ⚠️ Ce que cette décision RENVERSE, et qu’il faut dire

`01-Specs/widget.md` écrivait, du lanceur : « elle ne pulse pas, ne rebondit pas, **n’affiche
pas de badge** ». `ui/styles.ts` va plus loin et nomme le badge de non-lus parmi les trois
choses qu’on laisse délibérément à Intercom, avec la bulle d’accueil automatique et les
avatars.

La pastille de réponse en attente **est** un badge de non-lus. C’est donc un renversement, pas
une précision — et le dire coûte moins cher que de réécrire l’ancienne règle en « pas de
badge *intrusif* » pour qu’elle cesse de gêner.

Ce qui la sépare de celle d’Intercom : elle ne compte pas, elle ne s’anime pas, elle
n’apparaît que sur un geste du développeur, et elle disparaît définitivement au premier
regard. ⚠️ Si l’une de ces quatre conditions tombe, c’est cette décision qu’il faut rouvrir,
pas la pastille qu’il faut ajuster.

Deux bornes les tiennent, et sans elles la pastille dérivait **vers** le badge Intercom :

- **trois cartes au plus** dans le panneau. Solder dix vieux retours d’un coup poussait sinon
  le micro hors de l’écran, et le widget cessait de servir à parler ;
- **trente jours de vie** pour une réponse jamais lue. Une pastille posée depuis trois mois
  n’est plus une information : c’est une tache, et une obligation.

### Les invariants préservés

- **Frontière de licence** : les contrats de transport sont 100 % MIT (`packages/widget`),
  aucune dépendance AGPL ne remonte.
- **Budget de 60 Ko gzip tenu** : aucun import lourd ni dépendance externe dans `widget.js`.
- **Zéro compte, zéro email**.
- **Vocabulaire** : le mot « ticket » reste banni de l’ensemble du code, du schéma et des tables.

### Ce qui la renverserait

Un logiciel hôte doté de son propre centre de notifications unifié demandant un webhook complémentaire
pour intégrer ces accusés à son flux natif. Si ce besoin émergeait, le webhook serait un complément,
jamais un substitut à la notification native dans le widget.

---

## D-022 — On sauvegarde le fil brut, pas la note — et sept jours suffisent

**Prise le** : 2026-09-07
**Statut** : appliquée

### Le contexte

`hebergement.md` promettait « un dump quotidien de Postgres, plus le volume de stockage, rétention
30 jours ». ⛔ **Rien ne l’implémentait** : pas un `pg_dump` dans le dépôt, pas de script, pas de
cron. Et l’étape 2 de la liste de mise en service exige de restaurer un dump **pour de vrai avant la
pose**, ce qu’on ne pouvait donc pas faire.

L’objection posée était juste, et mérite d’être écrite : **la note part déjà par email, sur Telegram,
sur Slack — pourquoi sauvegarder ?**

### La décision

**On sauvegarde, mais l’argument est l’inverse de celui qu’on croit.**

Ce qui part par email est la **synthèse** : le résumé, quelques citations. C’est-à-dire le
**dérivé** — et précisément la seule chose qui se **régénère**, par
`pnpm entretien:rejouer --synthese`.

⛔ Ce qui n’existe nulle part ailleurs qu’en base est le **fil brut** : ce que la personne a dit,
ses hésitations, le transcript avant correction. C’est la matière qui sert à régler le prompt, et la
seule façon de vérifier qu’une note n’a pas déformé quelqu’un. Autrement dit : **l’email sauvegarde
le régénérable et laisse tomber l’irremplaçable.**

⚠️ Et la table `produits`. La perdre n’est pas relancer une commande : c’est retourner voir le
développeur de chaque logiciel hôte pour qu’il change sa ligne de `<script>` et sa signature
d’identité, dans **son** logiciel.

**Sept jours, pas trente.** Quelques dizaines de retours par jour, une machine, un volume : ce
qu’on couvre est la panne franche — disque, volume corrompu, `docker volume rm` malheureux. Une
semaine y suffit largement, et trente jours n’achetaient qu’une cérémonie.

**Le volume de stockage n’est pas sauvegardé**, et c’est explicite : la capture est un aide-mémoire
et non une preuve, et le widget envoie aujourd’hui un transcript, pas de l’audio. ⛔ Ça change le
jour où Whisper arrive ([ROADMAP](ROADMAP.md) ④) — l’audio devient alors la source, et cette ligne
est à rouvrir.

### Ce qui la renverserait

Whisper en production, ou le premier hôte qui garde de l’audio : le volume devient aussi précieux
que la base, et sept jours ne suffisent plus à couvrir une découverte tardive.

---

## D-023 — TLS devant, jamais dans le conteneur — et l’en-tête qui décide du débit

**Prise le** : 2026-09-07
**Statut** : appliquée

### Le contexte

`docker-compose.production.yml` publie sur `127.0.0.1:3000` avec, en commentaire, « c’est le proxy
de la machine qui termine TLS ». ⛔ **Ce proxy n’existait nulle part** : ni fichier, ni exemple, ni
un mot sur le certificat. Or sans HTTPS valide, la balise `<script src="https://…">` posée dans une
page HTTPS est refusée par le navigateur : **le widget ne se charge pas du tout**.

### La décision

Le conteneur reste en **HTTP sur la boucle locale**, et ne sait rien de TLS. Deux montages
supportés, selon ce que la machine a déjà :

| Situation | Ce qu’on pose |
|---|---|
| La machine héberge déjà les logiciels métier — elle a donc un proxy | un vhost, `deploiement/nginx-feedys.conf.exemple` |
| Feedys est seul sur sa machine | `docker-compose.tls.yml`, qui ajoute un Caddy |

⚠️ **Caddy plutôt que nginx + certbot dans le second cas**, et c’est le seul argument qui compte :
le renouvellement est automatique et n’a pas de chemin d’échec silencieux. Un certificat qui expire
un dimanche est une panne totale du widget chez tous les hôtes en même temps.

⛔ **Et jamais les deux.** Ils se battraient pour les ports 80 et 443.

### ⛔ Les trois réglages qui décident, et qui ne sont pas du confort

1. **`X-Forwarded-For`.** Feedys en tire l’IP pour limiter le débit, avec un repli sur
   `« inconnue »`. Si le proxy ne pose pas l’en-tête, **tout le monde partage un seul seau** : dix
   tours d’entretien par minute pour l’entreprise entière. Deux personnes qui parlent en même temps
   suffisent à en bloquer une troisième, avec un message qui parle de débit dépassé. Caddy le fait
   seul ; nginx demande deux lignes explicites.
2. **`client_max_body_size 4m`.** L’API borne elle-même à 4 Mio et rend un 413 qui explique. nginx
   plafonne à **1 Mio par défaut** : la coupure viendrait du proxy, muette, et le widget
   l’afficherait comme une panne réseau.
3. **Pas de compression au proxy.** Feedys compresse `widget.js` lui-même et pose un ETag **qui
   dépend de l’encodage**. Un proxy qui re-compresse casse les `304`, et le budget de 60 Ko se
   mesure sur le fichier tel qu’il est servi.

⚠️ Les trois sont des **modes de défaillance différés** : rien ne casse au déploiement, tout casse
la semaine suivante, sous une forme qui n’accuse jamais le proxy.

### Ce qui la renverserait

Un hébergement qui impose son propre terminateur TLS — un load balancer d’infrastructure, par
exemple. Le conteneur n’a rien à changer : c’est exactement ce que
[§La forme](../04-Architecture/hebergement.md) exige, aucun mécanisme du logiciel ne dépend du
fournisseur.

---

## D-024 — Le correctif se consigne dans `marquer_retour`, et Feedys ne vérifie jamais chez la forge

**2026-09-08**

### Le problème

Un retour marqué `traite` ne disait rien de ce qui l’avait réparé. Six semaines plus tard, personne
ne savait quel commit corrigeait quoi — ni si quelque chose avait été corrigé. **« Traité » était
une affirmation que rien ne venait étayer**, et un agent de code pouvait la poser sans avoir touché
une ligne.

Le manque était le plus visible côté MCP : l’agent lit le retour, écrit le correctif, marque
`traite` — et le lien entre les trois n’existait nulle part.

### Les alternatives écartées

1. **Un quatrième outil MCP, `tracer_correctif`** :
   ⛔ **Rejeté.** Consigner le correctif et marquer « traité » sont **le même geste** ; deux appels,
   c’est un agent qui en oublie un. Et `packages/mcp/src/outils.ts` écrit noir sur blanc qu’il n’y
   aura pas de quatrième outil — l’amender aurait demandé une raison plus forte que le confort.
2. **Une table `correctifs` en 1-n** :
   ⛔ **Rejeté.** Elle aurait porté plusieurs commits par retour, les réouvertures et les reverts.
   Mais `audit` fait déjà exactement cela : append-only, une ligne par marquage, avec l’avant et
   l’après. La table aurait dupliqué l’historique pour un produit qui a un développeur et quatre
   logiciels. Colonnes typées pour l’**état**, `audit` pour l’**histoire**.
3. **Vérifier le commit auprès de la forge** :
   ⛔ **Rejeté, et c’est la moitié de cette décision.** Cela ferait entrer dans le serveur un jeton
   GitHub, une dépendance réseau sur un tiers, et un périmètre qui n’est pas le sien. Feedys écoute
   des collaborateurs et transmet des notes ; il n’audite pas un dépôt.
4. **Un correctif facultatif partout** :
   ⛔ **Rejeté.** Facultatif, il serait vide — et on aurait payé une migration pour trois colonnes
   que personne ne remplit.

### La décision

**`marquer_retour` porte le correctif, et `traite` l’exige.**

```ts
{ id, statut, reponse?, correctif?: { ref?, note? } }
```

- ⛔ **`correctif` est EXIGÉ pour `traite`**, refusé avec `lu`, facultatif pour `ecarte`. `note`
  seule suffit : un correctif qui tient dans une configuration n’a pas de SHA, et le refuser
  obligerait à inventer une référence.
- ⛔ **`reponse` et `correctif.note` ne se recopient jamais.** Deux publics, deux langues :
  « corrigé dans `useTableState` » n’a aucun sens pour quelqu’un qui a dit « le tri se remet à
  zéro ».
- ⛔ **La forme de `ref` est vérifiée — SHA de 7 à 40 hex, ou URL https —, son existence ne l’est
  pas.** Un SHA inventé produit un lien mort, qui se voit en un clic. C’est préférable à une
  vérification silencieuse qu’on aurait cessé de lire.
- **L’état remplace, l’audit s’empile.** `correctif_le` ne bouge que si le correctif change
  réellement : `idempotentHint: true` reste vrai.
- **Le back-office affiche, il ne saisit pas.** La surface modifiable à la main reste étroite.

Le détail : [01-Specs/tracabilite-du-correctif.md](../01-Specs/tracabilite-du-correctif.md).

### Ce qui la renverserait

Un retour qui se corrige couramment en plusieurs commits **et** dont on veut lire la liste sans
ouvrir l’audit : la table 1-n redeviendrait le bon outil. Ou l’arrivée d’un second développeur qui
marque « traité » depuis le back-office plus souvent que par MCP — l’exigence changerait alors de
chemin, ou deviendrait un champ de formulaire.

---

## D-025 — Le modèle déclare l’axe, le dépôt écrit les valeurs

**2026-09-08**

### Le problème

Au tour 1, le bot pose une question ouverte en deux phrases. Pour répondre « oui, c’est
systématique », il faut réactiver le micro ou retaper une phrase. Pour quelqu’un de pressé, c’est
le moment où l’on referme le panneau — et un entretien abandonné au tour 1 vaut la parole brute,
sans rien de ce que la relance devait établir.

L’idée d’origine : faire générer au modèle deux ou trois réponses rapides à côté de sa question,
affichées en boutons cliquables.

### Les alternatives écartées

1. **Le modèle écrit lui-même les libellés** — « Systématique », « Première fois », « Seulement sur
   certains dossiers ».
   ⛔ **Rejeté**, pour trois raisons dont une décisive.
   - **La parole fabriquée devient citable.** Une réponse cliquée entre dans le fil en ligne
     `collaborateur`, et `parolesDe()` en fait du matériau de citation. Le développeur lirait entre
     guillemets un mot que le bot a écrit. Le défaut existe **déjà**, en plus petit :
     [BUGS_LOG](../03-Bugs/BUGS_LOG.md) 016.
   - **Le mot est déjà pris, avec le sens inverse.** `domaine/synthese/schema.ts` et
     [01-Specs/synthese.md](../01-Specs/synthese.md) interdisent « toute suggestion technique » :
     deux sens opposés du même mot dans le même domaine.
   - **Le modèle jugerait seul si sa question est fermée.** Rien ne l’en empêche sur « qu’est-ce que
     vous veniez de faire, juste avant ? », et trois boutons sous une question ouverte remplacent un
     récit par un mot. Le taux d’abandon baisserait pendant que la note se vide.
2. **Aucun bouton : la question met en évidence le champ de la carte qu’elle vise.**
   ⛔ **Rejeté, mais de peu.** Économe — zéro composant — et ça règle la redondance avec la carte.
   Mais la carte ne porte que `type`, `titre`, `resume`, `ecran` et `recurrence` : l’**ampleur**
   (« ça vous bloque, ou ça vous ralentit ? »), seule question du tableau §*Ce qu’il est utile de
   demander* valable pour un bug **et** pour une idée, n’y a pas de champ.
3. **Ajouter `ampleur` à la carte de compréhension.**
   ⛔ **Rejeté.** Une sixième ligne éditable, « (non précisé) » la plupart du temps, sur un panneau
   étroit, qui pousse le micro vers le bas de l’écran. La carte est ce que le bot a **compris**, pas
   un formulaire à remplir ([01-Specs/entretien.md](../01-Specs/entretien.md) §La carte de
   compréhension).

### La décision

**Le modèle décide *quand*, le code décide *quoi*.** C’est déjà la découpe de `RELANCE_INAUDIBLE`
(« écrite ici et pas demandée au modèle ») et celle de `verbatim.ts`.

À côté de sa question, le modèle déclare un **axe fermé** — ou `null`. Il n’écrit aucun libellé :
les valeurs et leurs libellés sont dans le dépôt.

| axe | valeurs | ce qu’il alimente |
|---|---|---|
| `recurrence` | `premiere_fois` · `deja_vu` · `systematique` | `Comprehension.recurrence` **et** `Synthese.recurrence` — mêmes valeurs, vérifié |
| `ampleur` | `bloque` · `ralentit` · `agace` | `Synthese.impact`, aujourd’hui **obligatoire et deviné** — `indetermine` est l’échappatoire du modèle |

- ⛔ **Deux axes, et pas un de plus.** Ce sont les deux seules lignes fermées du tableau §*Ce qu’il
  est utile de demander*. Les quatre autres appellent un récit. `Synthese.frequence` est un texte
  libre : le fermer serait inventer une énumération que rien n’a mesurée.
- ⛔ **Aucune puce « Autre ».** Elle ferait du bloc un choix obligatoire. Le champ texte et le micro
  **sont** l’autre, au même niveau de visibilité (CLAUDE.md §La parole d’abord).
- ⛔ **Le widget envoie la valeur, jamais le libellé.** Les libellés français du widget restent côté
  MIT ; le serveur écrit la ligne du fil dans ses propres mots, côté AGPL. Ce qui traverse la
  frontière est une **forme** — une énumération —, jamais du texte d’interface.
- ⛔ **Une réponse d’un clic n’est pas de la parole.** Elle entre dans le fil en ligne
  `collaborateur` — elle vient bien de la personne — mais marquée `geste = 'reponse_axe'`, et
  **exclue du bassin des citations**.
- **Ce qu’on sait de source sûre l’emporte sur ce que le modèle déduit.** Un axe répondu **fixe**
  `impact` ou `recurrence` dans la synthèse, sur le modèle de `plafonnerConfiance`.
- **Les verrous sont côté serveur, dans `borner()`** : pas de question → pas d’axe ; `recurrence`
  déjà posée → pas d’axe (règle 1 : on ne demande pas ce qu’on a) ; valeur hors énumération →
  jetée. Le widget ne décide rien, comme pour les relances.
- **Aucun appel de modèle supplémentaire.** L’axe voyage dans le `generateObject` du tour, pour
  quelques jetons de sortie.

⚠️ **`messages.geste` est posé par P-025, avec ses deux valeurs déclarées d’emblée.** P-025 n’utilise
que `correction` et P-026 ajoute `reponse_axe` — mais `alter type … add value` ne permet pas
d’employer la valeur dans la transaction qui l’ajoute, et les migrations du dépôt sont
transactionnelles. Déclarer les deux d’un coup coûte un mot ; les séparer coûterait une migration
en deux temps pour rien.

### Ce qui la renverserait

Un relevé montrant que les clics **remplacent** la parole au lieu de la relancer : des entretiens
qui se terminent au tour 1 sur un bouton, avec des notes plus pauvres qu’avant. La mesure est
disponible sans travail — `messages.geste = 'reponse_axe'`, rapporté au nombre de tours. Ou
l’inverse : trois axes fermés supplémentaires qui émergent de vrais retours, et la table de
libellés en dur deviendrait le mauvais outil.
