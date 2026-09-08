/**
 * Le dépôt du MCP — lister, lire, marquer.
 *
 * ⛔ **AUCUNE ÉCRITURE, SAUF LE STATUT.** Ce fichier ne contient pas une requête
 *    qui touche `messages`, `syntheses` ou `contextes`. Ce que quelqu’un a dit ne
 *    se réécrit pas (04-Architecture/conventions-db.md §Ce qu’on n’efface pas).
 *
 * ⛔ Toute la logique est de l’autre côté : ici il n’y a que du SQL et une
 *    transaction (architecture.md §3).
 *
 * ⚠️ Le changement de statut journalise, comme au back-office, et dans la MÊME
 *    transaction. L’acteur est `developpeur` : c’est bien lui, à travers son
 *    agent.
 */
import type {
  RequeteListe,
  ReponseListe,
  ReponseRetour,
  RequeteStatut,
} from '../../../../packages/mcp/src/contrat'
import { lienCorrectif } from '../../domaine/retours/correctif'
import { analyserSynthese } from '../../domaine/synthese/schema'
import { identifiant } from '../identifiants'

import type { Bassin } from './depot-retours'
import { ecritureCorrectif, ecritureStatut } from './sql-statut'

/** ⚠️ Un agent qui liste veut une page, pas un export. */
const LIMITE_PAR_DEFAUT = 25

const LISTE = `
  select r.id, r.titre, r.type, r.statut, r.zone, r.cree_le,
         p.nom as produit,
         s.confiance
    from retours r
    join produits p on p.id = r.produit_id
    left join syntheses s on s.retour_id = r.id
   where ($1::statut_retour is null or r.statut = $1::statut_retour)
     and ($2::type_retour is null or r.type = $2::type_retour)
     and ($3::text is null or r.zone ilike '%' || $3 || '%')
     and ($4::timestamptz is null or r.cree_le >= $4::timestamptz)
   order by r.cree_le desc
   limit $5
`

const RETOUR = `
  select r.id, r.statut, r.source, r.auteur_nom, r.auteur_role,
         r.identite_verifiee, r.cree_le,
         r.reponse_texte, r.reponse_envoyee_le, r.reponse_lue_le,
         r.correctif_ref, r.correctif_note, r.correctif_le,
         p.nom as produit, p.url_forge,
         s.contenu, s.modele,
         c.url, c.titre_page, c.ecran, c.selecteur_dom, c.navigateur, c.systeme,
         c.viewport_l, c.viewport_h, c.fuseau
    from retours r
    join produits p on p.id = r.produit_id
    left join syntheses s on s.retour_id = r.id
    left join contextes c on c.retour_id = r.id
   where r.id = $1
   limit 1
`

/** ⛔ Le FIL BRUT. C’est la moitié de la valeur de `lire_retour`. */
const FIL = `
  select ordre, role, texte
    from messages
   where retour_id = $1
   order by ordre asc
`

const LIRE_AVANT = 'select statut from retours where id = $1 for update'

const JOURNALISER = `
  insert into audit (id, retour_id, acteur, action, detail)
  values ($1, $2, 'developpeur', 'statut', $3::jsonb)
`

function ouNul(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.trim() !== '' ? valeur : null
}

function entierOuNul(valeur: unknown): number | null {
  return typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : null
}

function isoDe(valeur: unknown): string {
  return valeur instanceof Date ? valeur.toISOString() : String(valeur ?? '')
}

/** ⚠️ Les clés nulles sont retirées : un agent lit mieux six lignes que dix-huit. */
function contexteDe(ligne: Record<string, unknown>): Record<string, unknown> | null {
  const brut: Record<string, unknown> = {
    url: ouNul(ligne['url']),
    titre_page: ouNul(ligne['titre_page']),
    ecran: ouNul(ligne['ecran']),
    selecteur_dom: ouNul(ligne['selecteur_dom']),
    navigateur: ouNul(ligne['navigateur']),
    systeme: ouNul(ligne['systeme']),
    viewport_l: entierOuNul(ligne['viewport_l']),
    viewport_h: entierOuNul(ligne['viewport_h']),
    fuseau: ouNul(ligne['fuseau']),
  }

  const garde = Object.fromEntries(
    Object.entries(brut).filter(([, valeur]) => valeur !== null),
  )

  return Object.keys(garde).length === 0 ? null : garde
}

function isoOuNul(valeur: unknown): string | null {
  return valeur instanceof Date ? valeur.toISOString() : null
}

/**
 * ⚠️ `null` tant que personne n’a rien dit au collaborateur. Sans ce bloc, un
 *    agent qui rouvre un retour six semaines plus tard réécrit le même mot à
 *    quelqu’un qui l’a déjà lu : le serveur tenait l’idempotence tout seul, et
 *    n’en disait rien à personne.
 */
function reponseDe(ligne: Record<string, unknown>): ReponseRetour['reponse'] {
  const texte = ouNul(ligne['reponse_texte'])
  const envoyeeLe = isoOuNul(ligne['reponse_envoyee_le'])

  if (texte === null && envoyeeLe === null) return null

  return { texte, envoyee_le: envoyeeLe, lue_le: isoOuNul(ligne['reponse_lue_le']) }
}

/** ⚠️ `url` est composée ici, jamais appelée : Feedys ne parle pas à la forge (D-024). */
function correctifDe(ligne: Record<string, unknown>): ReponseRetour['correctif'] {
  const ref = ouNul(ligne['correctif_ref'])
  const note = ouNul(ligne['correctif_note'])

  if (ref === null && note === null) return null

  return {
    ref,
    note,
    le: isoOuNul(ligne['correctif_le']),
    url: lienCorrectif(ouNul(ligne['url_forge']), ref),
  }
}

export interface DepotMcp {
  lister(requete: RequeteListe): Promise<ReponseListe>
  lire(retourId: string): Promise<ReponseRetour | null>
  marquer(retourId: string, changement: RequeteStatut): Promise<boolean>
}

export function creerDepotMcp(bassin: Bassin): DepotMcp {
  return {
    async lister(requete: RequeteListe): Promise<ReponseListe> {
      const connexion = await bassin.connect()

      try {
        const { rows } = await connexion.query(LISTE, [
          requete.statut ?? null,
          requete.type ?? null,
          requete.zone ?? null,
          requete.depuis ?? null,
          requete.limite ?? LIMITE_PAR_DEFAUT,
        ])

        return {
          retours: rows.map((ligne) => ({
            id: String(ligne['id']),
            titre: ouNul(ligne['titre']),
            type: ouNul(ligne['type']) as ReponseListe['retours'][number]['type'],
            statut: String(ligne['statut']) as ReponseListe['retours'][number]['statut'],
            zone: ouNul(ligne['zone']),
            produit: String(ligne['produit']),
            confiance: ouNul(ligne['confiance']) as ReponseListe['retours'][number]['confiance'],
            recu_le: isoDe(ligne['cree_le']),
          })),
        }
      } finally {
        connexion.release()
      }
    },

    async lire(retourId: string): Promise<ReponseRetour | null> {
      const connexion = await bassin.connect()

      try {
        const { rows } = await connexion.query(RETOUR, [retourId])
        const ligne = rows[0]
        if (ligne === undefined) return null

        const messages = await connexion.query(FIL, [retourId])

        return {
          id: String(ligne['id']),
          statut: String(ligne['statut']) as ReponseRetour['statut'],
          produit: String(ligne['produit']),
          auteur: ouNul(ligne['auteur_nom']),
          auteur_role: ouNul(ligne['auteur_role']),
          identite_verifiee: ligne['identite_verifiee'] === true,
          source: ligne['source'] === 'texte' ? 'texte' : 'voix',
          recu_le: isoDe(ligne['cree_le']),
          synthese: analyserSynthese(ligne['contenu']) ?? null,
          modele: ouNul(ligne['modele']),
          // ⛔ Le fil brut, toujours, et entier.
          fil: messages.rows.map((tour) => ({
            ordre: Number(tour['ordre']),
            role: tour['role'] === 'bot' ? ('bot' as const) : ('collaborateur' as const),
            texte: String(tour['texte'] ?? ''),
          })),
          contexte: contexteDe(ligne),
          reponse: reponseDe(ligne),
          correctif: correctifDe(ligne),
        }
      } finally {
        connexion.release()
      }
    },

    /** ⛔ La seule écriture du MCP. Elle et sa trace partent ensemble ou pas du tout. */
    async marquer(retourId: string, changement: RequeteStatut): Promise<boolean> {
      const connexion = await bassin.connect()

      try {
        await connexion.query('begin')

        const { rows } = await connexion.query(LIRE_AVANT, [retourId])
        const avant = rows[0]

        if (avant === undefined) {
          await connexion.query('rollback')
          return false
        }

        // ⚠️ Le MÊME SQL que le back-office (`sql-statut.ts`) : marquer par MCP
        //    ou à la main doit produire exactement le même état.
        const ecriture = ecritureStatut(changement.statut, changement.reponse)
        await connexion.query(ecriture.sql, [retourId, ...ecriture.parametres])

        // ⛔ Le correctif REMPLACE. Ce qui s’empile, c’est la ligne d’audit
        //    juste en dessous — et elle, rien ne l’efface.
        const trace = ecritureCorrectif(changement.correctif)
        if (trace !== null) await connexion.query(trace.sql, [retourId, ...trace.parametres])

        await connexion.query(JOURNALISER, [
          identifiant(),
          retourId,
          JSON.stringify({
            avant: String(avant['statut']),
            apres: changement.statut,
            // ⚠️ Par où c’est passé : une trace qui ne dit pas « par MCP » oblige
            //    à deviner, six mois plus tard, qui a marqué quoi.
            par: 'mcp',
            ...(ecriture.mot ? { reponse: ecriture.mot } : {}),
            // ⚠️ Le correctif est journalisé À CHAQUE marquage, même identique :
            //    c’est ce qui rend l’historique lisible quand un même retour a
            //    été corrigé deux fois, ou corrigé puis re-cassé.
            ...(trace === null
              ? {}
              : {
                  correctif: {
                    ...(trace.ref === null ? {} : { ref: trace.ref }),
                    ...(trace.note === null ? {} : { note: trace.note }),
                  },
                }),
          }),
        ])

        await connexion.query('commit')
        return true
      } catch (erreur) {
        await connexion.query('rollback')
        throw erreur
      } finally {
        connexion.release()
      }
    },
  }
}
