# Feedys — l’image de production.
#
# Un conteneur, un Postgres (04-Architecture/hebergement.md). L’image construit
# le serveur ET le widget : `widget.js` n’est pas un paquet npm que l’hôte
# empaquette, c’est un fichier que NOUS servons — c’est la frontière de licence
# qui l’exige (04-Architecture/licences.md).
#
#   docker build -t feedys .
#   docker run --env-file .env.local -p 3000:3000 feedys
#
# ⛔ Aucun secret n’entre à la construction. `FEEDYS_VERSION` est le seul
#    argument, et ce n’est pas un secret : c’est l’article 13 de l’AGPL.

# ─────────────────────────────────────────────────────────────────────────────
# 1. Les dépendances
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /depot

RUN corepack enable

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/serveur/package.json apps/serveur/
COPY packages/widget/package.json packages/widget/
COPY packages/mcp/package.json packages/mcp/

# ⚠️ `--frozen-lockfile` : une image qui résout ses versions toute seule ne
#    construit pas deux fois la même chose.
RUN pnpm install --frozen-lockfile

# ─────────────────────────────────────────────────────────────────────────────
# 2. La construction — le serveur et le widget
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS construction
WORKDIR /depot

RUN corepack enable

ENV NEXT_TELEMETRY_DISABLED=1
ENV TURBO_TELEMETRY_DISABLED=1

COPY --from=deps /depot/node_modules ./node_modules
COPY --from=deps /depot/apps/serveur/node_modules ./apps/serveur/node_modules
COPY --from=deps /depot/packages/widget/node_modules ./packages/widget/node_modules
COPY --from=deps /depot/packages/mcp/node_modules ./packages/mcp/node_modules
COPY . .

# ⚠️ Le client Prisma est un miroir typé, généré — il n’est pas dans le dépôt.
RUN pnpm db:generate
RUN pnpm build

# ─────────────────────────────────────────────────────────────────────────────
# 3. L’image servie
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS production
WORKDIR /app

ARG FEEDYS_VERSION=dev

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# ⚠️ La version déployée, affichée en pied de back-office avec le lien vers la
#    source. C’est l’article 13 de l’AGPL, pas une décoration.
ENV FEEDYS_VERSION=${FEEDYS_VERSION}

# ⚠️ Trois dossiers que le code cherche par variable, parce que dans l’image il
#    n’y a ni `apps/`, ni `packages/`, ni `pnpm-workspace.yaml` à remonter.
ENV FEEDYS_ACTIFS=/app/actifs
ENV FEEDYS_PROMPTS=/app/prompts
ENV FEEDYS_MIGRATIONS=/app/migrations
ENV FEEDYS_STOCKAGE=/stockage

# ⛔ Le serveur ne tourne pas en root. `node` existe déjà dans l’image amont.
RUN mkdir -p /stockage && chown -R node:node /stockage

# Le serveur autonome : Next n’y met que les dépendances réellement atteintes.
COPY --from=construction --chown=node:node /depot/apps/serveur/.next/standalone ./
COPY --from=construction --chown=node:node /depot/apps/serveur/.next/static ./apps/serveur/.next/static

# ⚠️ Le widget et snapdom dans UN dossier — c’est ce que `FEEDYS_ACTIFS` désigne.
COPY --from=construction --chown=node:node /depot/packages/widget/dist/widget.js ./actifs/widget.js
COPY --from=construction --chown=node:node /depot/apps/serveur/node_modules/@zumer/snapdom/dist/snapdom.js ./actifs/snapdom.js

# ⚠️ Les deux prompts dans UN dossier, pour la même raison : la hiérarchie du
#    dépôt n’existe pas ici (apps/serveur/infra/prompts.ts).
COPY --from=construction --chown=node:node /depot/apps/serveur/domaine/entretien/prompts/systeme.md ./prompts/systeme.md
COPY --from=construction --chown=node:node /depot/apps/serveur/domaine/synthese/prompts/synthese.md ./prompts/synthese.md

# ⛔ La source de vérité du schéma. Appliquée au démarrage, jamais à la main.
COPY --from=construction --chown=node:node /depot/db/migrations ./migrations

USER node
EXPOSE 3000
VOLUME ["/stockage"]

# ⚠️ La sonde interroge la base et les migrations, rien d’autre : un modèle ou un
#    relais SMTP en panne ne doit pas faire redémarrer le conteneur.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/sante').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# ⚠️ Les six étapes du démarrage tournent dans `instrumentation.ts`, que Next
#    appelle avant de servir. Un échec y tue le processus
#    (04-Architecture/hebergement.md §Le démarrage).
CMD ["node", "apps/serveur/server.js"]
