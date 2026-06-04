#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Error: Please specify the backup directory path to restore."
  echo "Usage: ./restore.sh ./backups/YYYYMMDD_HHMMSS"
  exit 1
fi

BACKUP_DIR="$1"

echo "=================================================="
echo "Restoring A-RAG Platform from $BACKUP_DIR"
echo "=================================================="

# 1. Restore PostgreSQL
echo "Restoring PostgreSQL database..."
docker exec -i my-postgres psql -U admin -d ragstore_prod < "$BACKUP_DIR/postgres_backup.sql"

# 2. Restore MinIO files
echo "Restoring MinIO files..."
docker cp "$BACKUP_DIR/minio_data" arag-minio:/data
docker restart arag-minio

echo "=================================================="
echo "Restore Completed successfully!"
echo "Note: Re-run ingestion indexing if vector data was not fully captured."
echo "=================================================="
