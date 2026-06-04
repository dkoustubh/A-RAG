#!/bin/bash
set -e

echo "=================================================="
echo "Installing A-RAG Platform on Remote Workstation"
echo "=================================================="

# Check if docker is available
if ! [ -x "$(command -v docker)" ]; then
  echo "Error: docker is not installed. Please install Docker first." >&2
  exit 1
fi

# Copy .env configuration
if [ ! -f .env ]; then
  echo "Creating .env configuration file from .env.example..."
  cp .env.example .env
fi

# Build and start services
echo "Building and spinning up Docker containers..."
docker compose up -d --build

echo "=================================================="
echo "Installation complete! Services running on ports:"
echo "FastAPI Backend: http://127.0.0.1:8082"
echo "Vite Frontend: http://127.0.0.1:3002"
echo "Redis Broker: http://127.0.0.1:6378"
echo "Qdrant Vector DB: http://127.0.0.1:6333"
echo "Neo4j Graph: http://127.0.0.1:7474"
echo "MinIO Object Store: http://127.0.0.1:9000"
echo "=================================================="
