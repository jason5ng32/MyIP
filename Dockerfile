# Build stage
FROM node:24-alpine AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:24-alpine AS production-stage
WORKDIR /app
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
