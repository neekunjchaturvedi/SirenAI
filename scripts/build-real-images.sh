#!/usr/bin/env bash
# Build the real-server images Siren monitors:
#   siren-real-server:v1        GOOD:   /health 200
#   siren-real-server:v2-db     BROKEN: MONGODB_URI missing      -> /health 503  (fix: ROLLBACK)
#   siren-real-server:v2-health BROKEN: bad release regression   -> /health 503  (fix: ROLLBACK)
# (the 'memory' fault is injected at runtime on v1 and fixed by a RESTART)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CTX="$ROOT/services/real-test-server"

# A realistic-looking (credential-free) URI is enough — the demo checks presence,
# it does not open a real connection. Override with GOOD_DB_URI if you want.
GOOD_DB_URI="${GOOD_DB_URI:-mongodb+srv://ecom-prod.bx8elms.mongodb.net/ecom}"

echo "==> Building siren-real-server:v1 (good)"
docker build --build-arg SIREN_FAULT=none --build-arg MONGODB_URI="$GOOD_DB_URI" -t siren-real-server:v1 "$CTX"

echo "==> Building siren-real-server:v2-db (broken — MONGODB_URI missing)"
docker build --build-arg SIREN_FAULT=db -t siren-real-server:v2-db "$CTX"

echo "==> Building siren-real-server:v2-health (broken — release regression)"
docker build --build-arg SIREN_FAULT=health --build-arg MONGODB_URI="$GOOD_DB_URI" -t siren-real-server:v2-health "$CTX"

echo "==> Done."
docker image ls --filter=reference='siren-real-server' --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}'
