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

---

## D-026 — Le navigateur relève des indices, et Feedys corrèle plutôt qu’il ne recopie

**2026-09-09**

### Le problème

Un collaborateur dit « j’ai cliqué sur valider et rien ne s’est passé ». La note part comme ça, et
le développeur passe une heure à reproduire à l’aveugle — alors que le navigateur, lui, savait :
une exception avait été levée, ou une requête était revenue en 500, quelques secondes plus tôt.

`01-Specs/widget.md` excluait explicitement « aucune trace de console ni de réseau ».

### ⚠️ Ce que cette décision RENVERSE, et qu’il faut dire

**La règle d’occupation n°1** — « *aucun travail avant l’interaction. Le premier appel réseau a lieu
quand on clique* ». Un collecteur qui n’écoute qu’à partir du clic n’a rien à raconter : c’est tout
son objet d’avoir écouté avant. Le renversement est réel et assumé.

Ce qu’il coûte vraiment : deux `addEventListener` passifs et un `PerformanceObserver`. ⛔ Aucune
requête réseau, aucun `setInterval`, aucune écriture, aucun travail au fil de l’eau — les
gestionnaires poussent dans un tableau borné à trois entrées. **La seconde moitié de la règle —
« le premier appel réseau a lieu quand on clique » — reste vraie mot pour mot.** Mesuré le
2026-09-09 : le collecteur pèse **2,3 Ko gzip**, et le bundle passe de 29,4 à 31,8 Ko sur 60.

Et une limite qui vient avec, qu’aucune astuce ne lève : le script est en `defer`, donc il
s’exécute après l’analyse du document. Ce qui casse pendant le démarrage de l’hôte est hors de
portée du relevé passif. `PerformanceObserver` avec `buffered: true` en rattrape la part réseau ;
la part exceptions, non.

### Les trois chemins, dans l’ordre de valeur par octet

1. **La corrélation** — un `reference` opaque (id Sentry, `trace_id`, `request_id`) que le
   back-office rend cliquable via `produits.url_observabilite`. ⛔ **Feedys n’appelle jamais
   l’outil de l’hôte**, exactement comme il n’appelle jamais la forge (D-024). C’est le champ le
   plus léger et le plus utile : il emmène le développeur vers **sa** pile démappée, avec sa
   version et son contexte serveur — tout ce que recopier l’erreur ne donne pas.
2. **L’API poussée** — `window.feedys.indice({…})`, et une file `window.feedys.indices` vidée au
   montage pour ce qui précède le chargement. ⚠️ Elle existe parce qu’**une error boundary React
   avale l’exception** : en React 18 comme en 19, une erreur de rendu attrapée par une boundary ne
   remonte pas à `window`. Dans une application métier correctement écrite, l’écran blanc ne
   produit donc **aucun** indice passif. C’est aussi le seul chemin qui porte une `reference` et une
   méthode HTTP.
3. **Le relevé passif** — `addEventListener('error')`, `'unhandledrejection'`, et
   `PerformanceObserver`. Il marche sans aucune intégration, et c’est sa seule supériorité.

### ⛔ Ce que le relevé ne prend pas, et pourquoi

- **Le message d’une exception.** `error.message` est du texte libre écrit par le code de l’hôte.
  « *Le dossier de M. Dupont (n° 4417) est verrouillé par Marie Lefèvre* » est une phrase qu’un
  logiciel métier lève tous les jours ; elle finirait en base, dans un email, puis dans une note
  lue par un agent de code — **dans un dépôt public**. On garde `error.name` et la **première
  trame** : ce qui localise, et qui est structurellement stable.

  ⚠️ Second motif, moins visible : `domaine/entretien/prompts.ts` justifie par écrit l’absence de
  risque d’injection par le fait que le contexte est « *une DONNÉE STRUCTURÉE […] pas une phrase
  qu’on a dictée* ». Un message d’exception peut contenir de la saisie utilisateur ; le joindre
  invaliderait un argument de sécurité déjà consigné dans le code. `nom` + `trame` le laisse intact.

- **Le chemin brut d’une requête.** `POST /api/dossiers/4417/valider` porte un numéro de dossier ;
  `/api/clients/jean.dupont@exemple.fr/relances` porte une adresse. Les segments identifiants sont
  remplacés par `:id` — avec **la liste de `contexte/ecran.ts`, importée et pas recopiée** — et la
  requête est retirée entièrement.

- **La console.** `console.error` n’est pas une exception, et une application métier en écrit des
  dizaines par jour.

- **`window.onerror`, `fetch` et `XMLHttpRequest`.** On n’assigne ni n’enveloppe rien.
  `window.onerror = …` écraserait le gestionnaire de l’hôte sans un mot ; envelopper son `fetch`
  quand on est un invité, c’est entrer dans sa chaîne de wrappers — Sentry, Datadog et Apollo en
  posent déjà —, fausser ses traces et devenir le suspect n°1 de son prochain bug.

- **Nos propres erreurs.** Tout ce dont la trame vient de l’origine Feedys est jeté. Sans ce
  filtre, le premier indice affiché serait Feedys accusant Feedys : `snapdom` écrit déjà dans la
  console de l’hôte (T-005).

⚠️ **`PerformanceResourceTiming.responseStatus` n’existe que sur Chromium**, et c’est exactement
l’univers que D-003 a déjà arrêté pour la dictée. La contrainte qui rend la parole possible rend ce
collecteur propre. Ailleurs, aucun indice `http` n’est relevé et rien ne se casse. ⚠️ **La méthode
HTTP n’est pas disponible par ce chemin** : un indice passif n’en porte pas. Limite honnête, pas
oubli.

### Ce qui borne : l’écran, pas la durée

⛔ **Le seuil de soixante secondes envisagé au départ était le mauvais axe.** Un poste de bureau
garde un onglet ouvert huit heures. Quelqu’un clique sur « Valider », rien ne se passe, il relit,
réessaie, appelle un collègue, **puis** ouvre la bulle — quatre minutes plus tard : le seuil aurait
jeté l’erreur. Et dans les soixante secondes précédant l’ouverture, il y a surtout le bruit
provoqué par l’ouverture elle-même.

Donc : **on ne jette rien sur l’âge, on date.** Les trois derniers indices survenus **depuis le
dernier changement d’écran**, chacun avec son `ecart_ms`. « il y a 3 s » et « il y a 2 h » ne pèsent
pas pareil, et c’est au développeur d’en juger, pas à un seuil codé en dur.

### Actif par défaut, montré, décochable

⛔ **Actif par défaut, et c’est un arbitrage.** En option d’adhésion, personne ne l’activerait et la
fonctionnalité serait morte née. Ce qui rend le défaut défendable est ailleurs :

- **le panneau le dit et le laisse décocher** — « Joindre 2 indices techniques relevés · voir »,
  dépliable sur exactement ce qui part. C’est le principe déjà posé pour l’écran déduit : « *la
  collecte est visible plutôt que subie* ». ⚠️ Un relevé joint sans être montré serait son exact
  inverse : le widget saurait de la personne quelque chose qu’elle ne sait pas.
- ⚠️ **Et il y a un gain qu’on n’attendait pas** : lire « une erreur technique a été relevée » dit à
  quelqu’un que **ce n’est pas sa faute**. Dans un logiciel métier, où l’on se soupçonne d’abord
  d’avoir mal cliqué, c’est un moment réel.
- `data-indices="non"` sur la balise coupe tout, sans redéploiement de notre part.

⚠️ Décocher **retire le champ**, il ne l’envoie pas vide : « le navigateur n’a rien relevé » et
« quelqu’un a refusé de joindre » ne se confondent pas, et la seconde ne nous regarde pas.

### Le bot s’en sert pour se taire, jamais pour parler

Un modèle à qui l’on donne « requête 500 sur `/api/factures` » **veut** le dire, et ce serait une
violation frontale de la règle 4 de `01-Specs/entretien.md`. Les indices entrent quand même dans le
prompt, parce que leur valeur est de **supprimer des questions** — mais la consigne de
non-diagnostic est produite par le **même `return`** que les données (`rendreIndices`), et pas
posée dans le gabarit. ⛔ On ne peut donc pas obtenir les lignes techniques sans le garde-fou, et
`prompts.test.ts` le vérifie.

### Le rangement

Une **table `indices`**, pas une colonne `jsonb` sur `contextes` : un indice est parfaitement
structuré, et `jsonb` est réservé au réellement non structuré. ⛔ **Il n’y a pas de colonne
`message`** — elle n’existe pas, donc on ne peut pas l’y écrire par accident le jour où quelqu’un
trouvera ça pratique. Le plafond de trois est appliqué par le contrat (donc par le serveur), pas par
le seul widget — même raisonnement que la limite de deux relances (D-006).

Le mot est **indice**, jamais « erreur » ni « log » : il dit *piste*, pas *cause*. Il est donc
non diagnostique par construction, ce qui l’aligne sur la règle 4 jusque dans le vocabulaire
([02-Metier/glossaire.md](../02-Metier/glossaire.md)).

### Ce qu’on n’a pas fait

- **Aucun rattrapage des exceptions d’avant le chargement**, hors `buffered` réseau. Un stub à
  poser dans le `<head>` de l’hôte casserait la promesse de l’intégration en une ligne.
- **Ni iframes ni web workers** : un écouteur du document parent ne les voit pas. Écrit en non-but
  plutôt que découvert en défaut ([TICKETS_DIFFERES](TICKETS_DIFFERES.md) T-011).
- **Aucune détection de « rien ne s’est passé »** — une requête qui n’est jamais partie est un
  signal réel, mais le mesurer demanderait de savoir ce que l’hôte aurait dû appeler.

### Ce qui la renverserait

La prémisse — « la plupart des bugs s’accompagnent d’une exception ou d’une erreur HTTP » — **n’est
pas mesurée**, et cette décision renverse un invariant. Elle doit donc porter sa mesure : la part
des retours qui arrivent avec au moins un indice, disponible sans travail
(`select count(distinct retour_id) from indices`, rapporté au nombre de retours).

**Sous 20 %, on retire le collecteur passif et on garde la corrélation** — qui ne coûte rien et ne
renverse aucune règle. Au-dessus de 60 %, le renversement de la règle 1 est payé.

L’inverse la renverserait aussi : un hôte dont les indices se révéleraient porteurs de données
métier malgré la normalisation. La réponse serait alors le retrait du relevé passif, pas un tamis
de plus.

---

## D-027 — Le widget n’exige rien du CSP de son hôte, et l’identité peut être une fonction

**2026-09-09**

Deux dettes envers le logiciel qui nous héberge, trouvées en préparant la première pose, et
réglées avant elle — après, la première serait devenue une négociation.

### 1 · La feuille de style est **construite**, pas posée en `<style>`

Un `<style>`, **même enfermé dans un shadow DOM**, est du style *en ligne* pour le navigateur : il
tombe sous `style-src`, et un hôte qui a une politique stricte le refuse.

**Le motif est une mesure, pas une intuition.** Le 2026-09-09, page nue, sous
`default-src 'self'`, sans `style-src 'unsafe-inline'` :

| | fond du lanceur | rayon | hauteur | console |
|---|---|---|---|---|
| `<style>` | `rgb(240,240,240)` — gris système | `0px` | `59px` | ⛔ `Applying inline style violates…` |
| + `style-src 'unsafe-inline'` | `rgb(44,62,100)` = `--w-accent` | `999px` | `48px` | vide |
| **feuille construite** | `rgb(44,62,100)` | `999px` | `48px` | **vide, SANS `unsafe-inline`** |

⛔ Le widget **montait et fonctionnait** dans les trois cas. Ce n’était pas « la bulle
n’apparaît pas » : c’était un bouton système gris et carré dans le coin d’un logiciel métier, plus
une erreur rouge dans sa console. Ça a l’air cassé, et c’est nous.

⛔ **Et ça contredisait notre propre doctrine.** [D-011] refuse de charger snapdom depuis un CDN
parce que « lui imposer un tiers au moment de l’exécution, **et la règle CSP qui va avec**, n’est
pas à nous de le décider ». Exiger `style-src 'unsafe-inline'` pour notre propre feuille était la
même faute, non appliquée jusqu’au bout.

**Ce que le widget demande désormais, mesuré** : `script-src` et `connect-src`, une seule origine,
et **rien d’autre** — vérifié sous `style-src 'none'` et `img-src 'none'` explicites, plus durs que
`'self'`. Le tableau complet, avec ce qui n’est **pas** exigé, est dans
[hebergement.md](../04-Architecture/hebergement.md) §La pose chez un hôte, et chaque ligne a son
test dans `tests/e2e/widget-csp.spec.ts`.

⚠️ **Le repli sur `<style>` reste, et il n’est pas facultatif.** `CSSStyleSheet` constructible
manque sur Safari < 16.4 et Firefox < 101. [D-003] exige Chrome ou Edge pour la **dictée**, jamais
pour le reste : ailleurs, le champ texte doit rester impeccable. Sur ces navigateurs-là, un
`<style>` et un CSP strict ne peuvent pas être vrais en même temps — le style l’emporte, parce
qu’un widget nu se voit et qu’un CSP relâché ne se voit pas.

⛔ **Pas de drapeau, pas de version, pas de négociation de capacités** pour choisir le chemin. Le
widget essaie le bon, se replie, et se tait. ⚠️ Mais le repli **ne doit pas devenir le chemin
ordinaire en silence** : rien n’est enveloppé dans un `try` global, chaque étape est vérifiée
positivement — la feuille a-t-elle été *analysée*, a-t-elle été *adoptée* —, et le chemin
réellement pris **se lit dans la racine** : une feuille adoptée et aucun `<style>`, ou l’inverse.

⚠️ **La preuve est portée par un parcours e2e, pas par un test unitaire**, et c’est délibéré :
happy-dom 20 sait construire une feuille, donc `montage.test.tsx` exerce bien le nouveau chemin —
mais un DOM en JavaScript ne dit rien d’un CSP. Seul un vrai Chromium peut refuser un `<style>`.

⚠️ **Ce que ça ne règle pas** : la **capture d’écran** coûte toujours deux directives à l’hôte —
snapdom pose un `<style>` dans le document de l’hôte et charge un SVG en `data:`. Sans elles, la
capture est simplement absente et l’envoi part quand même, mais la console de l’hôte porte deux
lignes rouges. Ce n’est pas notre code, et c’est écrit :
[T-010](TICKETS_DIFFERES.md).

### 2 · `window.feedys.identite` accepte une fonction

```js
window.feedys = { identite: () => monJetonCourant }
```

Le widget relit l’identité à chaque envoi ; le mécanisme existait, mais l’hôte devait **reposer une
chaîne lui-même** à chaque rotation de son jeton, et l’exemple du README lui donnait une heure. Or
dans un logiciel métier, un onglet ouvert toute la journée est la norme : passé une heure, les
retours arrivaient **sans auteur** — rien n’est perdu, mais
[P-020](../01-Specs/retour-au-collaborateur.md) ne peut plus revenir vers personne, c’est-à-dire
la suite que [ROADMAP](ROADMAP.md) classe ①.

⛔ **Synchrone, et pas de promesse.** Une fonction `async` ferait attendre le chemin d’envoi sur du
code de l’hôte : une de ses lenteurs, un de ses blocages, et c’est la parole de quelqu’un qui se
perd. **On ne perd jamais une parole pour un problème d’identité** (P-012). Le refus est écrit dans
`identite.ts` avec sa raison, et un test le tient — sans quoi quelqu’un ajoutera l’`await` dans six
mois.

⛔ **Une fonction qui lève, ou qui rend autre chose qu’une chaîne non vide, vaut identité absente**,
et l’exception ne remonte jamais : un bug chez l’hôte ne casse pas l’envoi.

⚠️ **La forme chaîne continue de marcher, à l’identique.** Aucun hôte existant n’a à bouger.

⚠️ **Et l’exemple du README dit maintenant son compromis** : douze heures, parce qu’un jeton qui
fuite vaut jusqu’à son expiration — ce qu’il permet est de faire passer un retour pour celui d’un
collègue, rien d’autre, ni chez l’hôte ni chez Feedys.

### Ce qui la renverserait

- **Pour le CSP** : un hôte dont la politique interdirait aussi `script-src` d’une origine tierce —
  il faudrait alors servir `widget.js` depuis son propre domaine, par un proxy, et c’est un tout
  autre montage. Ou une version de Chrome qui ferait tomber les feuilles construites sous
  `style-src` : le repli redeviendrait le seul chemin, et la dette de [D-011] serait à rouvrir en
  entier.
- **Pour l’identité** : un hôte incapable de fournir un jeton sans aller-retour réseau. Ce serait la
  seule raison de rouvrir l’asynchrone — et la réponse ne serait pas d’attendre à l’envoi, mais de
  laisser l’hôte **pousser** une nouvelle chaîne quand il l’a, ce qu’il peut déjà faire aujourd’hui.

---

## D-028 — Une installation par client, et une image publiée pour la poser

**2026-09-09**

### Le problème

Le dépôt supposait « une instance, un développeur, plusieurs de ses produits » ([D-005], repris par
[D-015]). **C’est l’inverse** : les logiciels métier tournent sur le VPS **de chaque client**, et
Feedys s’installe à côté d’eux, **une fois par client**.

Le conteneur le permettait déjà — il écoute sur la boucle locale, derrière le proxy en place, et ne
dépend d’aucun fournisseur ([hebergement.md](../04-Architecture/hebergement.md) §La forme). C’est le
reste qui ne suivait pas : **rien n’était publié** — la CI construisait l’image et la jetait —, et
**rien ne disait ce que cette topologie coûte**.

### ⚠️ Ce que cette décision RENVERSE, et qu’il faut dire

- **[D-005]** : « Une instance, un développeur, plusieurs de ses produits. Il n’y a pas de clients,
  pas d’organisations, pas d’isolation à prouver à un tiers. » ⛔ La première phrase est **fausse**.
  ⚠️ La seconde reste vraie, et c’est tout l’intérêt : il y a bien des clients, mais l’isolation
  n’est **pas à prouver**, elle est **physique**. Une machine, une base, un jeu de secrets. On n’a
  rien à démontrer parce qu’il n’y a rien à partager.
- **[D-015]** : sa dernière phrase se lit désormais **par installation**. Le motif tient entier — le
  secret chiffré protège un dump qui voyage —, et il protège même mieux ici, puisque
  `FEEDYS_CLE_CHIFFREMENT` diffère d’un client à l’autre.
- ⛔ **Ce qui ne change pas** : le multi-tenant reste hors périmètre **définitivement**
  ([ROADMAP](ROADMAP.md) §Ce qui n’arrivera pas). Une instance = un client = un produit. La
  distance entre « un client par instance » et « plusieurs clients par instance », c’est exactement
  la distance entre ce dépôt et un SaaS.

### Ce que la topologie coûte

Écrit en entier dans [hebergement.md](../04-Architecture/hebergement.md) §Une installation par
client, en quatre points qui se paient tous ailleurs qu’ici : **les retours sont les données du
client** — avec la phrase à porter au contrat —, **la mise à jour est manuelle et multiple**, **le
back-office et MCP se démultiplient**, **les secrets sont propres à chaque installation**.

⚠️ Un seul de ces quatre points est agréable : un client qu’on ne met pas à jour garde son ancien
widget, et **il n’y a jamais d’écart entre le widget et le serveur qui le sert** — ils sortent de la
même image. C’est la contrepartie heureuse de « N déploiements ».

### L’image publiée — sur GHCR, sur tag de version, et rien d’autre

⛔ **Sur tag de version uniquement, jamais à chaque commit vers `main`.** Publier une image, c’est
**distribuer** au sens de l’AGPL : l’article 13 veut que quiconque s’en sert à travers le réseau
puisse obtenir la source **de la version qui tourne**. Un commit sans tag ne désigne pas une
révision qu’on puisse nommer dans un pied de page ; un tag, si.

⛔ **Et le tag EST la version, verbatim.** `lienSource()`
([`apps/serveur/infra/source.ts`](../apps/serveur/infra/source.ts)) compose
`github.com/PrFcTv/feedys/tree/<FEEDYS_VERSION>`. Un tag `v1.4.0` dont on retirerait le `v` — le
réflexe le plus banal d’un pipeline — produirait `…/tree/1.4.0`, **un 404**. D’où la règle : le tag
est un **semver nu**, `1.4.0`, et le même mot sert de nom de tag, de `FEEDYS_VERSION`, d’étiquette
d’image et de cible au lien. La CI refuse tout le reste en le nommant, **retire l’image publiée pour
lui demander sa version**, et vérifie que le lien répond — c’est le seul contrôle qui attrape un
`--build-arg` oublié, et un `--build-arg` oublié est une image non conforme.

**Les deux alternatives écartées** :

- **publier à chaque commit vers `main`.** Le SHA serait un ref valide, donc l’article 13 serait
  techniquement satisfait. Mais on distribuerait alors des images que personne n’a décidé de livrer,
  et « quelle version tourne chez ce client » deviendrait un SHA de quarante caractères. Le tag est
  précisément le geste qui dit « celle-ci » ;
- **une étiquette `latest`.** Confortable, et c’est le problème : une installation qui la suivrait
  changerait de version **toute seule** au prochain `docker compose pull`. Or ce qui décide de mettre
  à jour le serveur de quelqu’un d’autre, c’est un humain. On publie donc une seule étiquette, la
  version.

⚠️ **Le job attend les six checks.** Un tag peut être posé sur n’importe quel commit, y compris un
commit qui n’est jamais passé par `main`. Publier chez des tiers une image non vérifiée serait pire
que ne rien publier.

⚠️ **Et le `push: false` de la CI reste**, sur les PR comme sur `main` : on continue de prouver à
chaque fois que l’image se construit et qu’elle refuse de démarrer sans ses variables. C’est le
sixième check, il ne bouge pas.

### ⛔ `linux/amd64` seulement — et c’est mesuré, pas supposé

**Mesure du 2026-09-09**, `docker buildx build --no-cache`, séquentiel, même machine, sortie
`cacheonly` :

| Plateforme | Cache froid | |
|---|---|---|
| `linux/amd64`, natif | **62 s** | |
| `linux/arm64`, sous QEMU | **319 s** | **5,1×** |

⚠️ **Ce que cette mesure prouve, et ce qu’elle ne prouve pas.** Elle prouve le rapport, et elle
prouve surtout que **l’image arm64 se construit** — la commande a rendu 0. Elle ne dit rien du temps
d’un runner GitHub, qui est une autre machine.

⚠️ **Et l’émulation n’est pas la seule voie** : GitHub offre des runners **arm64 natifs, gratuits
aux dépôts publics** (`ubuntu-24.04-arm`, généralement disponibles depuis le 2025-08-07). Le coût
réel ne serait donc pas 5,1× de temps, mais **un job de plus et une fusion de manifeste** — deux
pièces mobiles supplémentaires dans le seul pipeline qui n’a pas le droit d’échouer le jour où l’on
tague une version.

**On publie `linux/amd64` seul**, pour deux raisons et pas une de plus :

1. ⛔ **personne ne l’a demandée.** Aucun client ne tourne sur arm64 aujourd’hui. Publier « au cas
   où » n’est pas une décision, c’est son report ;
2. **le repli existe, il tient en une commande, et il est prouvé** : sur une machine arm64,
   `docker build .` produit l’image — rien dans le `Dockerfile` n’est propre à une architecture, et
   c’est justement ce que la mesure ci-dessus a vérifié en la construisant.

**Ce qui la renverserait** : le **premier client sur un VPS arm64** — les offres Ampere et Graviton
sont moins chères, ça arrivera. La réponse sera alors d’ajouter `linux/arm64` aux plateformes **et un
job sur `ubuntu-24.04-arm`**, pas de faire tourner QEMU cinq minutes à chaque version.

### ⛔ Ce qu’on ne construit pas, et qui aurait été tentant

- **Aucun « phone home »**, aucune vérification de version automatique, aucune télémétrie vers le
  développeur. C’était déjà la règle de §La forme ; ça devient ici une **clause de contrat** — « le
  logiciel ne communique avec aucun serveur appartenant à son éditeur » est une phrase qu’on peut
  faire lire à un client **parce que le code est public et qu’il peut la vérifier** ;
- **aucune mise à jour automatique dans le conteneur.** Ni `watchtower`, ni un `latest` qu’on
  suivrait ;
- **aucun agrégateur** qui verrait les N installations. Ce serait du multi-tenant, et ce serait le
  seul composant du produit à qui il faudrait ouvrir les bases de tous les clients à la fois.

**Ce qui renverserait la topologie** : un client qui refuserait d’héberger et voudrait que Feedys
tourne chez le développeur. C’est faisable **sans rien changer au logiciel** — c’est l’ancienne
forme. Mais alors les retours de ce client vivent chez le développeur, et c’est la **phrase du
contrat** qui change, pas le code.

---

## D-029 — La clé du modèle est celle du développeur, plafonnée par client — et un administrateur du client peut la lire

**2026-09-09**

### Le problème

`ANTHROPIC_API_KEY` vit dans `.env.production` sur la machine **d’un client** ([D-028]). C’est **le
seul endroit du produit où une fuite se paie en argent** : ailleurs — mot de passe de back-office,
jeton MCP, clé de chiffrement — une fuite ouvre des données, ce qui est grave autrement, mais ne
débite personne.

Et rien ne l’encadrait.

### Les trois options, pesées

**(a) Une clé et un workspace Anthropic plafonnés PAR CLIENT.**

- ✅ Le plafond **borne le dégât par construction** : une clé qui fuite coûte au plus le plafond du
  mois, et le mois suivant repart à zéro. C’est le seul garde-fou qui n’a pas à être écrit, testé,
  sauvegardé ni surveillé — il est chez le fournisseur ;
- ✅ **la révocation est unitaire** : couper la clé d’un client n’éteint le bot chez personne
  d’autre. C’est la même étanchéité que le reste de [D-028], appliquée au seul secret qui coûte ;
- ✅ **l’attribution est native** : la console du fournisseur montre la consommation par workspace,
  donc par client, sans qu’on écrive un compteur ;
- ✅ le développeur garde la main sur le modèle. `FEEDYS_MODELE` est explicite et l’identifiant
  employé est enregistré avec chaque synthèse (`domaine/synthese/produire.ts`) ; en changer reste sa
  décision, pas celle du client ;
- ⛔ **le coût est chez le développeur**, et c’est un vrai coût, à assumer dans son prix.

**(b) Le client fournit sa propre clé.**

- ✅ Le coût et le risque passent chez lui. Il n’y a plus rien à plafonner, ni à avancer ;
- ✅ **c’est la bonne réponse pour un client qui a déjà un compte** chez le fournisseur, ou dont la
  politique interdit que la parole de ses salariés transite par le compte d’un tiers ;
- ⛔ **la friction tombe au pire moment.** Il faut un compte, une carte, une facturation en dollars,
  et comprendre ce qu’est un jeton — au moment exact où l’installation doit tenir en une liste de
  vérification ;
- ⛔ **et ça déplace un mode de panne chez quelqu’un qui ne le regardera pas.** Un plafond atteint
  ou une carte expirée **fait taire le bot** : les entretiens échouent, les notes ne partent plus,
  et personne côté développeur n’est prévenu. Or le mode de défaillance le plus probable de Feedys
  est précisément le silencieux — « si ça tombe à zéro, le produit est mort, bien avant qu’une
  erreur ne le dise » ([hebergement.md](../04-Architecture/hebergement.md) §Ce qui doit être
  surveillé).

**(c) Une passerelle chez le développeur, que les instances appellent.**

- ✅ La vraie clé ne quitte jamais sa machine. Le client n’a qu’un jeton de passerelle, révocable, et
  le plafond devient fin, par client et par période ;
- ⛔ **elle fait exactement ce que [hebergement.md] §La forme interdit** : le conteneur dépendrait
  d’un service extérieur. Une instance chez un client tomberait parce qu’une machine du développeur
  est tombée — le contraire de la topologie qu’on vient de choisir ;
- ⛔ **et c’est la pire des trois du point de vue des données.** La parole des collaborateurs — la
  matière la plus sensible du produit — quitterait le serveur du client pour transiter par une
  machine du développeur. Aujourd’hui l’appel part de l’instance vers le fournisseur, point ; avec
  une passerelle il y a un intermédiaire de plus à sécuriser, à faire figurer au contrat, et à ne
  surtout pas journaliser. ⛔ Ça casse la phrase « le logiciel ne communique avec aucun serveur
  appartenant à son éditeur », qui est ce qu’on donne à lire au client ;
- ⛔ **et ce serait du multi-tenant par la bande** : un service partagé qui distingue les clients,
  qui compte et qui plafonne, c’est-à-dire des comptes et des organisations. Exclu définitivement
  par la [ROADMAP](ROADMAP.md) ;
- ⛔ enfin, c’est **un service de plus à écrire, déployer, surveiller et sauvegarder**, pour un dépôt
  d’une personne.

### La décision — (a), et (b) sans discuter quand le client le demande

**(a)** est la forme par défaut : une clé et un workspace plafonnés **par client**, chez le
développeur. **(c)** est écartée pour de bon — pas parce qu’elle est chère, mais parce qu’elle fait
transiter la parole des gens par une machine de plus.

⚠️ **(b) n’est pas un échec, c’est un réglage** : c’est la même variable, `ANTHROPIC_API_KEY`, et le
produit ne change pas d’une ligne. Ce qui change, c’est **qui paie et qui surveille**. Un client qui
a déjà un compte, ou dont la politique l’exige, met la sienne.

### ⛔ La contrepartie de (a), en clair

**Un administrateur système du client peut lire la clé.** Elle est dans `.env.production`, ou dans le
fichier d’environnement que Kamal pose en `0600` — dans les deux cas sur une machine dont il est
root. Rien ne l’en empêche :

- la chiffrer au repos ne sert à rien : il faudrait la clé de déchiffrement au même endroit ;
- les permissions Docker ne protègent de personne qui peut faire `docker inspect` ;
- et le processus doit bien l’avoir en clair pour appeler le fournisseur.

⛔ **Le plafond est donc la SEULE chose qui borne le dégât.** Il n’y a pas de second garde-fou, et il
ne faut pas prétendre le contraire. Un plafond mal réglé — ou pas réglé du tout — et la décision (a)
n’offre plus rien.

⚠️ Ce que ça permet concrètement : appeler le modèle pour son propre compte, sur la facture du
développeur, jusqu’au plafond. **Pas** de lire les retours d’un autre client — la clé ne donne accès
à aucune donnée, et les autres secrets sont propres à chaque installation ([D-028]).

### ⛔ Et on n’écrit aucun code pour ça

Pas de plafond applicatif, pas de compteur de jetons, pas de télémétrie.

- La **limitation de débit par clé et par IP existe déjà** et couvre ce qu’elle doit couvrir : l’abus
  par le widget, dont la clé publique est dans le HTML de l’hôte. Le tour d’entretien est le seul
  endroit qui appelle le modèle, et il est le plus serré — dix par minute et par IP
  (`domaine/retours/debit.ts`) ;
- un **compteur applicatif serait un second registre à tenir juste** : il divergerait de la facture,
  il faudrait le sauvegarder, et il finirait par répondre à côté le jour où on lui poserait la
  question ;
- un plafond **applicatif** couperait le bot au milieu d’un entretien pour protéger une facture. Or
  ce produit perd sa valeur au moment exact où quelqu’un parle et où rien ne part.

**Le reste se règle chez le fournisseur, pas ici.** C’est le même raisonnement que la sonde qui
n’interroge pas le modèle : on ne met pas dans le logiciel un mécanisme dont le bon endroit est
ailleurs.

### Ce qui la renverserait

- **Le nombre.** À dix clients, dix workspaces plafonnés se tiennent dans une console. À cinquante,
  régler et relire les plafonds devient un travail — et **(b)** redevient raisonnable, chacun payant
  ce qu’il consomme ;
- **une clé restreinte par le fournisseur** — bornée à un modèle et à un débit, révocable, sans
  workspace à créer. La contrepartie de (a) tomberait presque entièrement, et il n’y aurait plus
  qu’à en délivrer une par installation ;
- **une fuite réelle qui coûterait plus que le plafond.** Ça voudrait dire que le plafond était mal
  réglé, pas que la décision était fausse ;
- **un client dont la politique interdit que sa parole transite par le compte d’un tiers** → **(b)**,
  sans discuter. Ça ne renverse pas la décision, ça exerce l’exception qu’elle prévoit.
