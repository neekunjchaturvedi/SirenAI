# Real e-commerce server, monitored by Siren.
# Build context = this directory (services/real-test-server).
#
# Three images are built from this one Dockerfile (see scripts/build-real-images.sh):
#   v1        good    --build-arg SIREN_FAULT=none   --build-arg MONGODB_URI="…/ecom"
#   v2-db     broken  --build-arg SIREN_FAULT=db     (no MONGODB_URI)
#   v2-health broken  --build-arg SIREN_FAULT=health --build-arg MONGODB_URI="…/ecom"
#
# The fault is baked into the IMAGE (ARG -> ENV), NOT supplied at runtime, so an
# image rollback (v2-* -> v1) is what heals the baked faults. A third fault
# (memory) is injected at runtime and is cleared by a restart instead.

FROM node:20-slim
WORKDIR /app

# Install deps (incl. dev deps: TypeScript is needed to build).
COPY package.json package-lock.json ./
RUN npm ci

# Source + compile to dist/. `src/proto` is required at runtime by grpc.ts.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Bake the fault variant + DB config into the image.
ARG SIREN_FAULT=none
ENV SIREN_FAULT=${SIREN_FAULT}
ARG MONGODB_URI=
ENV MONGODB_URI=${MONGODB_URI}
ENV PORT=5000
ENV NODE_ENV=production

EXPOSE 5000
CMD ["node", "dist/index.js"]
