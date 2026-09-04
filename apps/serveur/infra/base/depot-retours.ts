/**
 * Le dépôt des retours — l’implémentation du port que `domaine/retours` déclare.
 *
 * ⛔ Toute la logique est de l’autre côté : ici il n’y a que du SQL et une
 *    transaction (architecture.md §3).
 */
import type {
  PortDepotRetours,
  ProduitConnu,
  RetourAEnregistrer,
} from '../../domaine/retours/ingestion'
import { identifiant } from '../identifiants'
import { cleDeChiffrement, dechiffrer } from '../secret'

import type { ConnexionBase } from './migrations'

/** Une connexion louée à un pool, qu’on rend après usage. */
export interface ConnexionLouee extends ConnexionBase {
  release(): void
}

/** Ce qu’on attend d’un pool. `pg.Pool` le satisfait tel quel. */
export interface Bassin {
  connect(): Promise<ConnexionLouee>
}

/**
 * ⚠️ Un produit inactif est rendu tel quel, avec `actif: false`. C’est le domaine
 *    qui décide qu’il vaut refus — le dépôt ne fait pas de politique.
 */
const PAR_CLE = `
  select id, domaine, actif, secret_chiffre
    from produits
   where cle_publique = $1
   limit 1
`

/** ⚠️ `identite_verifiee` est écrite explicitement, jamais laissée au défaut. */
const ECRIRE_RETOUR = `
  insert into retours (id, produit_id, source, auteur_ref, auteur_nom, auteur_role, identite_verifiee)
  values ($1, $2, $3, $4, $5, $6, $7)
`

/** ⚠️ ordre = 0 : c’est le premier tour du fil. Pas de tri sur cree_le. */
const ECRIRE_MESSAGE = `
  insert into messages (id, retour_id, ordre, role, texte, transcript_brut, audio_chemin)
  values ($1, $2, 0, 'collaborateur', $3, $4, $5)
`

const ECRIRE_CONTEXTE = `
  insert into contextes (
    id, retour_id, url, titre_page, ecran, selecteur_dom, navigateur, systeme,
    viewport_l, viewport_h, capture_chemin, fuseau, agent_brut
  )
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
`

export function creerDepotRetours(bassin: Bassin): PortDepotRetours {
  return {
    async produitParCle(cle: string): Promise<ProduitConnu | null> {
      const connexion = await bassin.connect()

      try {
        const { rows } = await connexion.query(PAR_CLE, [cle])
        const ligne = rows[0]
        if (ligne === undefined) return null

        const chiffre = ligne['secret_chiffre']

        return {
          id: String(ligne['id']),
          domaine: String(ligne['domaine']),
          actif: ligne['actif'] === true,
          // ⛔ Déchiffré ici, et nulle part ailleurs. `null` sans clé, sans
          //    enveloppe, ou sur une enveloppe illisible — l’identité ne sera
          //    pas vérifiée, et le retour arrivera quand même (P-012).
          secret: dechiffrer(typeof chiffre === 'string' ? chiffre : null, cleDeChiffrement()),
        }
      } finally {
        connexion.release()
      }
    },

    /**
     * ⛔ Les trois lignes partent ensemble ou pas du tout. Un retour sans son
     *    message serait une parole perdue avec l’air d’avoir été reçue — pire
     *    qu’un refus franc.
     */
    async enregistrer(retour: RetourAEnregistrer): Promise<string> {
      const connexion = await bassin.connect()
      const idRetour = identifiant()

      try {
        await connexion.query('begin')

        await connexion.query(ECRIRE_RETOUR, [
          idRetour,
          retour.produitId,
          retour.source,
          retour.auteur.ref,
          retour.auteur.nom,
          retour.auteur.role,
          retour.auteur.verifiee,
        ])

        await connexion.query(ECRIRE_MESSAGE, [
          identifiant(),
          idRetour,
          retour.message.texte,
          retour.message.transcriptBrut,
          retour.message.audioChemin,
        ])

        const { contexte } = retour
        await connexion.query(ECRIRE_CONTEXTE, [
          identifiant(),
          idRetour,
          contexte.url,
          contexte.titrePage,
          contexte.ecran,
          contexte.selecteurDom,
          contexte.navigateur,
          contexte.systeme,
          contexte.viewportL,
          contexte.viewportH,
          contexte.captureChemin,
          contexte.fuseau,
          contexte.agentBrut === null ? null : JSON.stringify(contexte.agentBrut),
        ])

        await connexion.query('commit')
        return idRetour
      } catch (erreur) {
        await connexion.query('rollback')
        throw erreur
      } finally {
        connexion.release()
      }
    },
  }
}
