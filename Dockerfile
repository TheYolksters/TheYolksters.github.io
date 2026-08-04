# syntax=docker/dockerfile:1

# Debian-slim keeps native modules happy (sharp, Rolldown bindings).
FROM node:24-slim AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# --- Dev server with hot reload (default compose target) -------------
FROM base AS dev
ENV USE_POLLING=1
EXPOSE 4321
# Run astro directly (not via npm) so SIGTERM reaches it and it shuts
# down cleanly; --force replaces a stale dev-server lock left behind if
# a previous container was hard-killed.
CMD ["node", "node_modules/astro/bin/astro.mjs", "dev", "--host", "0.0.0.0", "--force"]

# --- Production build, served locally for a final look ----------------
FROM base AS preview
RUN npm run build
EXPOSE 4321
CMD ["node", "node_modules/astro/bin/astro.mjs", "preview", "--host", "0.0.0.0"]
