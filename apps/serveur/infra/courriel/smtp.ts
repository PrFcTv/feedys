/**
 * Le transport SMTP — nodemailer, configuré par `SMTP_URL`.
 *
 * ⚠️ POURQUOI UNE URL ET PAS CINQ VARIABLES. `smtp://utilisateur:motdepasse@
 *    hôte:587` tient dans une variable, se copie d’un fournisseur à l’autre, et
 *    ne laisse pas la moitié d’une configuration derrière elle quand on change
 *    de relais. `smtps://` pour TLS implicite (04-Architecture/hebergement.md
 *    §Les variables).
 *
 * ⛔ AUCUNE VALEUR DE SECRET N’EST JOURNALISÉE, ni à la connexion, ni à l’échec.
 *    Le dépôt est public et les journaux d’un conteneur se lisent.
 *
 * ⚠️ nodemailer 10 — MIT-0, zéro dépendance transitive
 *    (04-Architecture/dependances.md).
 */
import { createTransport } from 'nodemailer'
import type { Transporter } from 'nodemailer'

import type { MessageEmail } from '../../domaine/notification/message'
import type { PortSmtp } from '../../domaine/notification/envoyer'

export interface ReglagesSmtp {
  readonly url: string
  readonly expediteur: string
}

/**
 * ⚠️ Le transporteur est un singleton de module : recréer le transport à chaque
 *    note rouvrirait une session TLS par envoi. Il vit aussi longtemps que le
 *    processus.
 *
 * ⚠️ Le maintien du bassin de connexions se demande DANS l’URL — `?pool=true` —
 *    et non ici : tout ce qui décrit le relais tient dans la variable, ce qui
 *    évite d’avoir à toucher au code pour changer de fournisseur.
 */
let transporteur: Transporter | undefined
let urlDuTransporteur: string | undefined

function transportDe(url: string): Transporter {
  if (transporteur === undefined || urlDuTransporteur !== url) {
    transporteur = createTransport(url)
    urlDuTransporteur = url
  }

  return transporteur
}

export function creerSmtp(reglages: ReglagesSmtp): PortSmtp {
  return {
    async envoyer(destinataire: string, message: MessageEmail): Promise<void> {
      // ⛔ `text` et rien d’autre. Pas de `html` : un email de Feedys est un
      //    mémo (01-Specs/synthese.md §Le rendu par email).
      await transportDe(reglages.url).sendMail({
        from: reglages.expediteur,
        to: destinataire,
        subject: message.sujet,
        text: message.corps,
      })
    },
  }
}

/** Oublie le transporteur. ⚠️ Pour les tests uniquement. */
export function oublierSmtp(): void {
  transporteur = undefined
  urlDuTransporteur = undefined
}
