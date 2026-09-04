# Références visuelles

> Ce document existe pour une raison précise : **empêcher qu’on invente un objet déjà codifié.**
> Un widget de conversation est une forme que tout le monde connaît. La réinventer produit du
> générique — la seule chose qui ressemble à du « design d’IA », c’est ce qui n’a été copié sur
> rien.

## La méthode

**Copier les meilleurs de très près, et ne dévier que là où Feedys diffère vraiment.**

Feedys ne diffère qu’en un endroit : **la parole**. Donc :

| Écran | Ce qu’on fait |
|---|---|
| Lanceur, panneau, fil, accusé d’envoi | ⛔ On **copie**. Aucune originalité recherchée |
| **L’état « j’écoute »** | On dessine, en s’appuyant sur un geste déjà connu |
| **La carte de compréhension** | On dessine — c’est la seule forme sans précédent direct |

⛔ **Ne jamais conclure « rien n’existe » sans avoir ouvert au moins deux des sources ci-dessous.**

## Les produits à décalquer

### Intercom Messenger — la grammaire de la bulle

C’est **la** référence du lanceur et du panneau : dimensions, ancrage, transition d’ouverture,
comportement au redimensionnement, ce qui se passe quand la page défile derrière.

Ce qu’on lui prend : la mécanique. Ce qu’on lui laisse : ⛔ la bulle d’accueil automatique, les
avatars d’équipe, le badge de messages non lus. Feedys ne réclame jamais l’attention
([01-Specs/widget.md](../01-Specs/widget.md)).

### WhatsApp et Telegram — la note vocale

**La référence la plus importante du projet.** Maintenir pour parler, l’onde qui monte en direct,
relâcher pour terminer, glisser vers la gauche pour annuler.

⚠️ **Ce n’est pas une inspiration, c’est une décision** ([DESIGN.md](DESIGN.md)) : ce geste est
connu de tout le monde, il ne s’apprend pas, et le réinventer serait une faute pure. Ce qu’il faut
observer de près : le seuil de glissement, ce que devient l’onde au silence, et l’état de la
transition entre appui maintenu et mode mains libres.

### Linear — la densité et la retenue

Pour le **back-office**. La liste des retours doit ressembler à ça : dense, calme, sans carte, sans
ombre portée, sans espace perdu. Un outil qu’on ouvre deux fois par jour n’a pas besoin de
respirer, il a besoin de tenir à l’écran.

À observer : la hiérarchie typographique à trois niveaux seulement, et les états vides — qui sont
des écrans, pas des phrases grises.

### Raycast — les états de chargement

Pour le moment où **le bot réfléchit**. C’est un instant à risque : trop long, la personne ferme ;
mal traité, elle croit que c’est cassé. Raycast est ce qui se fait de mieux sur les transitions
courtes et les indicateurs qui ne clignotent pas.

## Les galeries

| Source | Ce qu’on y cherche | Accès |
|---|---|---|
| [Mobbin](https://mobbin.com/explore/web/screens/chat-detail) | captures réelles de produits, filtrables par motif — `chat detail`, `chat bot`. Le seul vraiment exhaustif | payant |
| [Refero](https://refero.design/) | l’alternative la plus proche, orientée web et SaaS | partiellement gratuit |
| [CollectUI](https://collectui.com/) | 14 000 références classées par motif | gratuit |
| [Godly](https://godly.website/) | les partis pris forts — ⚠️ à doser : c’est de la vitrine, pas de l’outil de travail | gratuit |
| [Checklist Design](https://www.checklist.design/) | **pas une galerie** : une liste de contrôle par composant | gratuit |

⚠️ **Checklist Design se passe avant de livrer, pas avant de dessiner.** C’est le seul de la liste
qui attrape les états qu’on oublie — le focus, le survol au clavier, le champ trop long, l’erreur
réseau.

## L’écran sans précédent : la carte de compréhension

C’est le seul endroit où les références ne servent à rien, parce que la forme n’existe pas
ailleurs : **le bot montre ce qu’il a compris, et on le corrige d’un clic sur le champ faux.**

Le cousin le plus proche est la **fiche d’événement d’un agenda** — une carte dont chaque ligne
devient éditable au clic, sans passer en « mode édition ». Deuxième cousin : les **suggestions de
correction d’un traitement de texte**, pour l’affordance discrète qui apparaît au survol.

⛔ Ce que ce n’est **pas** : un formulaire dans une bulle de chat, ni un message que le bot envoie
et qu’on commente. Voir [01-Specs/entretien.md](../01-Specs/entretien.md) §La carte de
compréhension.

## Les défauts qu’on refuse

La liste des choses qui font qu’une interface a l’air fabriquée à la chaîne :

- ⛔ un dégradé violet-bleu, où que ce soit ;
- ⛔ des emoji comme marqueurs de section ou d’état ;
- ⛔ des cartes arrondies avec un liseré de couleur à gauche, partout ;
- ⛔ tout centré, sans raison ;
- ⛔ une animation d’entrée en cascade sur des éléments qui n’arrivent pas en séquence ;
- ⛔ un état vide qui dit « Aucun résultat » sans dire quoi faire ensuite ;
- ⛔ des couleurs de statut qui sont **la seule** distinction entre deux états.

⚠️ Et le plus insidieux, propre à ce produit : **une onde audio animée en boucle** au lieu d’être
calculée depuis le micro. Ça se repère en une seconde, et ça discrédite tout le reste de
l’interface — si ça ment ici, pourquoi croire que le retour part vraiment ?
