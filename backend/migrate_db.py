import os
import sys
from app import create_app
from models import db
from flask_migrate import Migrate, upgrade, migrate, init, stamp

def run_migrations():
    # Create app
    app = create_app()
    
    # Initialize Flask-Migrate
    migrate_obj = Migrate(app, db)
    
    with app.app_context():
        # Create migrations directory if it doesn't exist
        migrations_dir = os.path.join(os.path.dirname(__file__), 'migrations')
        if not os.path.exists(migrations_dir):
            print("Initializing migrations...")
            init()
        
        # Create a new migration
        print("Creating migration...")
        migrate(message="Add user authentication tables")
        
        # Apply the migration
        print("Applying migration...")
        upgrade()
        
        print("Migration completed successfully!")

if __name__ == '__main__':
    run_migrations()
