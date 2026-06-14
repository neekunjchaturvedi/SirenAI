# Build from the repo root context: docker build -f services/operator/Dockerfile .
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY services/operator/package.json services/operator/
COPY services/prod-app/package.json services/prod-app/
COPY services/dashboard/package.json services/dashboard/
RUN npm ci
COPY packages/shared ./packages/shared
RUN npm run build --workspace packages/shared
COPY services/operator/tsconfig.json services/operator/
COPY services/operator/src services/operator/src
RUN npm run build --workspace services/operator

FROM node:20-slim AS runtime
WORKDIR /app/services/operator
ENV NODE_ENV=production
# node_modules (hoisted, incl. @siren/shared symlink) + the shared dist it points to
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages/shared/dist /app/packages/shared/dist
COPY --from=build /app/packages/shared/package.json /app/packages/shared/package.json
COPY --from=build /app/services/operator/dist ./dist
COPY services/operator/package.json ./package.json
EXPOSE 4000
CMD ["node", "dist/index.js"]
