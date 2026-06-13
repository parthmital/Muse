#!/bin/sh
# Docker entrypoint for the Muse backend image (API + worker).
#
# A fresh PostgreSQL database starts empty, and initDb() only opens the
# connection — it does NOT create tables. So we sync the schema with
# `prisma db push` before launching whatever command was passed (api server or
# worker). This is idempotent: on subsequent boots the schema already matches
# and db push is a no-op.
set -e

# Wait for PostgreSQL to accept the schema sync. depends_on (service_healthy)
# usually means it's ready, but a short retry loop keeps startup robust if the
# server is still finishing its boot.
echo "[entrypoint] Syncing database schema (prisma db push)…"
attempt=1
until npx prisma db push; do
	if [ "$attempt" -ge 10 ]; then
		echo "[entrypoint] Schema sync failed after $attempt attempts; giving up." >&2
		exit 1
	fi
	echo "[entrypoint] Database not ready yet (attempt $attempt) — retrying in 3s…"
	attempt=$((attempt + 1))
	sleep 3
done

echo "[entrypoint] Schema ready. Starting: $*"
exec "$@"
