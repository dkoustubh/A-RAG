#!/bin/bash
set -e

BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "=================================================="
echo "Initiating Backup to $BACKUP_DIR"
echo "=================================================="

# 1. Backup PostgreSQL
echo "Backing up PostgreSQL database..."
docker exec -t my-postgres pg_dump -U admin -d ragstore_prod > "$BACKUP_DIR/postgres_backup.sql"

# 2. Backup Qdrant snapshots
echo "Creating Qdrant snapshots..."
curl -X POST http://127.0.0.1:6333/collections/documents/snapshots -o "$BACKUP_DIR/qdrant_documents_snapshot.cb"

# 3. Backup Neo4j relationships
echo "Creating Neo4j Cypher export..."
# Use simple cypher MATCH export (since it's relationship-only)
docker exec -t arag-neo4j bin/cypher-shell -u neo4j -p "Ats@123*" \
  "MATCH (n)-[r]->(m) RETURN n.name, type(r), m.name" > "$BACKUP_DIR/neo4j_relations.txt"

# 4. Backup MinIO files
echo "Archiving MinIO storage data..."
docker cp arag-minio:/data "$BACKUP_DIR/minio_data"

echo "=================================================="
echo "Backup Completed successfully!"
echo "Saved in: $BACKUP_DIR"
echo "=================================================="
