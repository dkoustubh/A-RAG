#!/bin/bash
set -e

echo "Updating A-RAG Platform Services..."

# Pull new docker layers
docker compose pull

# Rebuild custom backend and frontend services
docker compose build backend frontend

# Restart the containers
docker compose up -d

echo "Services updated and restarted successfully."
