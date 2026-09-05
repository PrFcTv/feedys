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
