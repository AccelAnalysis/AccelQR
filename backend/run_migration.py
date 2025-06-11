from app import create_app
from flask_migrate import Migrate, upgrade, migrate, init, stamp
from models import db

def run_migration():
    # Create the Flask app
    app = create_app()
    
    # Initialize Flask-Migrate
    migrate_obj = Migrate(app, db)
    
    with app.app_context():
        # Stamp the current database state
        print("Stamping database with current migrations...")
        stamp()
        
        # Apply any pending migrations
        print("Applying any pending migrations...")
        upgrade()
        
        print("Database is up to date!")

if __name__ == '__main__':
    run_migration()
