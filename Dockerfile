# Build stage
FROM node:24-alpine AS build-stage
# corepack ships with the node image and provisions pnpm at the version pinned
# by the `packageManager` field in package.json — no global npm install needed.
RUN corepack enable
WORKDIR /app
# Copy the manifests first so this layer (and the install below) stays cached
# unless dependencies actually change. pnpm-workspace.yaml carries the
# allowBuilds approvals; pnpm-lock.yaml is required by --frozen-lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# Production stage
FROM node:24-alpine AS production-stage
WORKDIR /app
# node_modules is copied as-is from the build stage (pnpm's symlink farm into
# .pnpm is preserved within /app), so the runtime needs no install step.
COPY --from=build-stage /app/node_modules ./node_modules
COPY --from=build-stage /app/package.json ./
COPY --from=build-stage /app/dist ./dist
COPY --from=build-stage /app/backend-server.js ./
COPY --from=build-stage /app/frontend-server.js ./
COPY --from=build-stage /app/api ./api
COPY --from=build-stage /app/common ./common

EXPOSE 18966

# Start application
CMD ["npm", "start"]
