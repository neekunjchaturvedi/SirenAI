# Build from the repo root context: docker build -f services/dashboard/Dockerfile .
# Note: the dashboard talks to the operator from the BROWSER, so VITE_OPERATOR_URL
# defaults to http://localhost:4000 (operator's published port on the host).
FROM node:20-slim AS build
WORKDIR /app
ARG VITE_OPERATOR_URL=http://localhost:4000
ENV VITE_OPERATOR_URL=$VITE_OPERATOR_URL
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY services/dashboard/package.json services/dashboard/
COPY services/operator/package.json services/operator/
COPY services/prod-app/package.json services/prod-app/
RUN npm ci
COPY packages/shared ./packages/shared
RUN npm run build --workspace packages/shared
COPY services/dashboard ./services/dashboard
RUN npm run build --workspace services/dashboard

FROM nginx:alpine
COPY services/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/services/dashboard/dist /usr/share/nginx/html
EXPOSE 5173
