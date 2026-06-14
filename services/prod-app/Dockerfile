# Build from the repo root context: docker build -f services/prod-app/Dockerfile .
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY services/prod-app/package.json services/prod-app/
COPY services/operator/package.json services/operator/
COPY services/dashboard/package.json services/dashboard/
RUN npm ci
COPY services/prod-app/tsconfig.json services/prod-app/
COPY services/prod-app/src services/prod-app/src
RUN npm run build --workspace services/prod-app

FROM node:20-slim AS runtime
WORKDIR /app/services/prod-app
ENV NODE_ENV=production
# node_modules is hoisted to the repo root by npm workspaces.
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/services/prod-app/dist ./dist
COPY services/prod-app/package.json ./package.json
EXPOSE 8080
CMD ["node", "dist/index.js"]
