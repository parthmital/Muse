#!/bin/sh
# Docker entrypoint for the Muse backend image (API + worker).
#
# The runtime container starts from an empty SQLite file on a fresh volume, and
# initDb() only sets PRAGMAs — it does NOT create tables. So we sync the schema
# with `prisma db push` before launching whatever command was passed (api server
# or worker). This is idempotent: on subsequent boots the schema already matches
# and db push is a no-op.
set -e

echo "[entrypoint] Syncing database schema (prisma db push)…"
npx prisma db push

echo "[entrypoint] Schema ready. Starting: $*"
exec "$@"
