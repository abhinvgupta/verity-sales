# Backend image for the Verity API + queue worker. Both processes run from the
# same build — the compose file (or `docker run`) selects the entrypoint via the
# container command: `dist/main.js` for the HTTP API, `dist/main.worker.js` for
# the BullMQ worker.
#
# Build context is the MONOREPO ROOT (not apps/api), so the shared workspace
# package and the bun lockfile are available:
#   docker build -f apps/api/Dockerfile -t verity-backend .

# ---- build stage ---------------------------------------------------------
# Built on node (the runtime) so native modules like bcrypt compile against the
# same ABI we run on. Bun is only the package manager / task runner.
FROM node:22-slim AS build

# bcrypt falls back to node-gyp when no prebuilt binary matches; keep the
# toolchain available so the install never fails.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Bring in the bun binary from the official image.
COPY --from=oven/bun:1 /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app

# Install deps first against just the manifests for better layer caching.
COPY package.json bun.lock turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile

# Build only the backend and its dependency; the shared package must compile
# first because the api imports its emitted types. The web app is never built.
COPY . .
RUN cd packages/shared && bun run build
RUN cd apps/api && bun run build

# ---- runtime stage -------------------------------------------------------
FROM node:22-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Copy the whole built workspace so the @verity/shared workspace symlink in
# node_modules resolves correctly.
COPY --from=build /app ./

WORKDIR /app/apps/api

EXPOSE 3000

# Default to the HTTP API; the worker service overrides this command.
CMD ["node", "dist/main.js"]
