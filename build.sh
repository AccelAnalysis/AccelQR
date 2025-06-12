#!/bin/bash
set -e  # Exit on error

echo "=== Build Script Started ==="
echo "Current directory: $(pwd)"

# Print environment variables for debugging
echo "\n=== Environment Variables ==="
echo "DATABASE_URL: ${DATABASE_URL:0:30}..."  # Only show first 30 chars of DB URL
echo "FLASK_ENV: $FLASK_ENV"

# Install Python dependencies
echo "\n=== Installing Dependencies ==="
pip install -r backend/requirements.txt

# Install Flask-Migrate if not already installed
pip install flask-migrate

# Initialize or upgrade the database
echo "\n=== Running Database Initialization ==="
python backend/init_db.py

# Run database migrations
echo "\n=== Running Database Migrations ==="
python backend/run_migrations.py

echo "\n=== Build Completed Successfully ==="
