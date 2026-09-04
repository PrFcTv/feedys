# Tickets différés

Ce qu’on a **choisi** de ne pas traiter maintenant. Chaque entrée porte un **déclencheur de
reprise** — la condition observable qui fera qu’on s’y remettra.

⚠️ Sans déclencheur, un ticket différé est un ticket abandonné qui s’ignore. Le déclencheur n’est
pas une date : c’est un fait qu’on pourra constater.

## Le format

```
## T-00X — Titre

**Différé le** : 2026-09-04, pendant P-00X
**Déclencheur de reprise** : le fait observable qui rouvre le sujet
**Coût estimé si on le fait plus tard** : identique | plus cher, et pourquoi

Ce que c’est, en trois lignes. Ce qu’on fait à la place en attendant.
```

---

## T-001 — Le poids du modèle VAD n’est pas dans le budget du widget

**Différé le** : 2026-09-04, à la rédaction de [05-Prompts/MVP.md]
**Déclencheur de reprise** : le premier build de P-006 qui dépasse 60 Ko gzip
**Coût si plus tard** : identique — c’est une décision de chargement, pas d’architecture

`@ricky0123/vad` embarque un modèle Silero en WASM, qui pèse largement plus que le budget de
60 Ko du widget. Il ne sert **que** pour le mode mains libres.

**En attendant** : le charger **à la demande**, au premier passage en mains libres, et jamais au
chargement du widget. Le geste par défaut — maintenir pour parler — n’en a pas besoin.

⚠️ Si le chargement différé se révèle trop lent à l’usage, l’alternative est un simple seuil
d’énergie sur l’`AnalyserNode` : moins bon, mais gratuit et déjà présent pour dessiner l’onde.

---

## T-002 — Le passage à la dictée locale de Chrome n’est pas instruit

**Différé le** : 2026-09-04, avec [D-003](DECISIONS_LOG.md)
**Déclencheur de reprise** : `SpeechRecognition.available({ langs: ['fr-FR'], processLocally: true })`
répond favorablement sur le poste, **ou** une exigence de confidentialité arrive
**Coût si plus tard** : identique

Chrome 139+ propose `processLocally` — le modèle SODA tourne sur la machine, l’audio ne sort
pas. La disponibilité de `fr-FR` n’a **pas** été vérifiée : elle est à mesurer, pas à supposer.

**En attendant** : Web Speech en mode par défaut, l’audio transite par Google. C’est assumé
([D-003]) et cohérent avec des logiciels qui utilisent déjà des services Google par ailleurs.

---

## T-003 — Aucun test ne couvre le widget dans un vrai navigateur tiers

**Différé le** : 2026-09-04
**Déclencheur de reprise** : le premier défaut d’isolation constaté chez un hôte réel
**Coût si plus tard** : **plus cher** — le défaut aura été vu par des collaborateurs avant nous

`pnpm widget:demo` sert une fausse application hôte hostile, et P-005 exige que le widget y
survive. Mais c’est **notre** page hostile, écrite en imaginant ce qui pourrait casser.

**En attendant** : la recette P-014 se joue sur `widget:demo`, et la première mise en service
réelle vaut recette. ⚠️ C’est le trou de couverture le plus large du MVP, et il est assumé
sciemment.
