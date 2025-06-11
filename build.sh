#!/bin/bash
set -e  # Exit on error

echo "=== Build Script Started ==="
echo "Current directory: $(pwd)"

echo "\n=== Backend Directory Contents ==="
ls -la backend/

echo "\n=== Installing Dependencies ==="
pip install -r backend/requirements.txt

echo "\n=== Running Database Initialization ==="
python backend/init_db.py

echo "\n=== Build Completed Successfully ==="
