# Journal des bugs

Un bug constaté reçoit une entrée **au moment où il est constaté**, pas au moment où il est
corrigé. Un bug corrigé passe à `✅ Résolu` **dans le commit qui le corrige**.

⚠️ **On n’efface pas une entrée résolue.** C’est la mémoire du projet : c’est elle qui évite de
réintroduire la même faute six mois plus tard, et qui explique pourquoi telle ligne de code
étrange existe.

## Le format

```
## 001 — Titre court, à l’indicatif présent

**Statut** : 🔴 Ouvert | 🟠 Contourné | ✅ Résolu (2026-09-04, PR #12)
**Constaté le** : 2026-09-04, pendant P-00X
**Où** : packages/widget/src/dictee/onde.ts

**Symptôme** — ce qu’on voit, du point de vue de celui qui l’a rencontré.

**Cause** — ce que c’était vraiment. ⚠️ À remplir seulement quand on SAIT ;
« sans doute un problème de timing » n’est pas une cause, c’est une hypothèse.

**Correctif** — ce qui a été changé, et pourquoi cette solution plutôt qu’une autre.

**Ce qui l’a laissé passer** — quel test manquait. C’est le champ le plus utile
du format : un bug qui n’apprend rien au harnais de test reviendra.
```

---

*Aucune entrée pour l’instant — le développement n’a pas commencé.*
