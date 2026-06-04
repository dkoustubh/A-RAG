#!/bin/bash
set -e

echo "Checking A-RAG Container States..."
docker ps --filter "name=arag-"

echo "--------------------------------------------------"
echo "Testing Database Connectivity..."

# Test Redis
if docker exec arag-redis redis-cli ping | grep -q "PONG"; then
  echo "Redis: HEALTHY"
else
  echo "Redis: DEGRADED"
fi

# Test Qdrant
if curl -s http://127.0.0.1:6333/readyz | grep -q "ready"; then
  echo "Qdrant Vector DB: HEALTHY"
else
  echo "Qdrant Vector DB: DEGRADED"
fi

# Test Backend API
if curl -s http://127.0.0.1:8082/ | grep -q "online"; then
  echo "FastAPI Backend: HEALTHY"
else
  echo "FastAPI Backend: DEGRADED"
fi

# Test Neo4j
if docker exec arag-neo4j cypher-shell -u neo4j -p "Ats@123*" "RETURN 1" >/dev/null 2>&1; then
  echo "Neo4j Graph: HEALTHY"
else
  echo "Neo4j Graph: DEGRADED"
fi
