#!/usr/bin/env python3
"""Run database migrations on startup."""
import os
import sys
from app import create_app
from flask_migrate import upgrade

def run_migrations():
    try:
        print("Starting database migrations...")
        
        # Create the Flask application
        app = create_app()
        
        # Get migrations directory
        migrations_dir = os.path.join(os.path.dirname(__file__), 'migrations')
        
        # Apply migrations
        with app.app_context():
            print("Applying database migrations...")
            upgrade(directory=migrations_dir)
            print("✓ Database migrations applied successfully!")
            
    except Exception as e:
        print(f"❌ Error running migrations: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    run_migrations()
