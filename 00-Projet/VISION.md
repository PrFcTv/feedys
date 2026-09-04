# Vision

## Le problème

Dans un logiciel métier interne, **les retours des utilisateurs n’arrivent pas.** Pas parce que
les gens n’ont rien à dire — ils en ont beaucoup — mais parce que le coût de le dire est trop
élevé pour ce que ça rapporte à celui qui parle.

Le calcul que fait un collaborateur, sans le formuler :

> « Ce bouton est mal placé. Pour le signaler, il faut que j’ouvre ma messagerie, que je trouve
> comment décrire ça par écrit, que j’explique où je suis dans le logiciel, que je fasse une
> capture. Dix minutes. Pour un bouton. Je laisse tomber. »

Ce calcul est **rationnel**, et il se répète dix fois par jour. Ce qui remonte finalement, c’est
uniquement ce qui a dépassé le seuil de l’insupportable — donc les gros bugs, tard, et jamais les
cent frictions quotidiennes qui font qu’un logiciel est pénible sans qu’on sache dire pourquoi.

**Les outils existants ne résolvent pas ça, ils l’aggravent.** Un formulaire de feedback, un
board de vote, un système de tickets : tous demandent d’écrire, de catégoriser, de titrer. Ils
déplacent le coût, ils ne le suppriment pas.

## Le pari

**Parler coûte quarante secondes et zéro effort de mise en forme.**

C’est la seule idée du produit, et tout le reste en découle. Si le geste devient « je clique, je
râle trente secondes, je ferme », alors le seuil s’effondre et le développeur reçoit enfin les
cent petites choses au lieu des trois grosses.

Reste un problème : **un retour dicté est riche mais informe.** « Ça marche pas quand je fais le
truc du mardi » n’est pas exploitable. C’est là qu’intervient le bot — non pas pour trier, mais
pour **finir la phrase à la place de celui qui parle**, en posant les deux questions que le
développeur aurait posées.

Et c’est le développeur, pas le collaborateur, qui paie ce travail de mise en forme — c’est-à-dire
personne, puisque le modèle s’en charge.

## Ce que Feedys fait

1. Une bulle discrète, présente en permanence dans le logiciel métier, qui ne bloque rien.
2. On clique. On parle. La transcription s’écrit sous les yeux.
3. Le bot **reformule ce qu’il a compris** et pose au plus deux questions de précision.
4. Il joint tout seul ce que personne ne pense à dire : l’écran, l’URL, le composant, le
   navigateur, et les trente secondes qui ont précédé.
5. Le développeur reçoit **une note rédigée** — le problème, le contexte, ce qui reste incertain,
   et les mots exacts du collaborateur.
6. Son agent de code interroge les retours par MCP, directement depuis l’éditeur.

## Ce que Feedys n’est pas

| Ce n’est pas | Parce que |
|---|---|
| Un board de vote (Canny, Fider, Productboard) | Le vote sert à arbitrer entre des milliers d’inconnus. Ici il y en a dix, ils se connaissent, et le développeur les écoute tous. |
| Un système de tickets | Un ticket implique un guichet, une file et un numéro. Feedys n’a rien de tout ça. Le mot est interdit. |
| Un outil de support | Personne ne répond en direct. Le bot ne dépanne pas, ne diagnostique pas, ne promet rien. |
| Un outil d’analytics | On ne mesure pas des parcours, on écoute des phrases. |
| Un produit à vendre | C’est un outil interne, publié en open source parce que ça ne coûte rien et que ça peut servir. Aucun plan tarifaire, aucun compte, aucune facturation. |

## Pour qui

**Les collaborateurs** — une dizaine par produit. Ils ne sont pas développeurs, ils n’ont pas de
compte Feedys, ils ne se connectent nulle part : le logiciel hôte sait déjà qui ils sont et le dit
au widget. Ils ne verront jamais que la bulle.

**Le développeur** — un seul, celui qui maintient les quatre logiciels. C’est lui qui lit les
notes, et c’est son temps qu’on économise. Le back-office est fait pour une personne qui ouvre
l’onglet deux fois par jour, pas pour une équipe produit.

## Le succès, mesuré

Une seule métrique compte, et elle est brutale :

> **Le nombre de retours qui n’auraient jamais été envoyés autrement.**

Concrètement : des retours sur des frictions mineures. Si Feedys ne reçoit que des bugs graves,
il a échoué — ceux-là remontaient déjà par téléphone. S’il reçoit « le tri de cette colonne me
fait perdre du temps tous les matins », il a gagné.

Deux garde-fous qui disent l’échec :

- **un entretien moyen au-delà de trois échanges** — le bot est devenu un formulaire ;
- **des retours qui s’arrêtent après deux semaines** — la nouveauté est passée et rien ne
  justifiait de revenir.

## Ce qui viendra après, et qu’on ne construit pas maintenant

Le socle doit rester capable de les accueillir, mais **rien de tout ceci n’est codé aujourd’hui** :

- le retour au collaborateur (« ce que vous avez signalé est corrigé ») — c’est la suite la plus
  évidente, et la plus efficace pour qu’il continue à parler ;
- le regroupement de retours qui parlent de la même chose ;
- l’ouverture automatique d’une issue ou d’une branche depuis une note ;
- d’autres canaux d’entrée (email, Slack) qui alimenteraient le même entretien.

Voir [ROADMAP.md] pour ce qui est réellement au programme.
