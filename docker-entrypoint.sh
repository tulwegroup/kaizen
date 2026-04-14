#!/bin/sh
# Run Prisma migrations then start the Express server (which serves frontend from /public)
npx prisma migrate deploy 2>/dev/null || npx prisma db push 2>/dev/null || true
exec "$@"
