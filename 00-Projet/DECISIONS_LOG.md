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
