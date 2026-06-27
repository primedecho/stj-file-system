#!/bin/sh
set -e

# Ensure the SQLite data directory exists when using a volume mount.
mkdir -p /app/data

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
