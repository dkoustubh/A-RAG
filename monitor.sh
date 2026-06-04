#!/bin/bash

echo "=================================================="
echo "A-RAG System Resource Monitor"
echo "=================================================="

echo "1. Container Status & Telemetry:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

echo "--------------------------------------------------"
echo "2. GPU Utilization (RTX Pro 6000):"
if command -v nvidia-smi &> /dev/null; then
  nvidia-smi --query-gpu=utilization.gpu,utilization.memory,memory.total,memory.used --format=csv
else
  echo "nvidia-smi not available on local host client."
fi

echo "=================================================="
