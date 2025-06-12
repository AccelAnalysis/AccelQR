import os
from app import create_app
from flask_migrate import upgrade

def apply_migration():
    """Apply the database migration to add user_id to qrcodes table."""
    try:
        # Create the Flask application
        app = create_app()
        
        # Push the application context
        with app.app_context():
            print("Applying database migration...")
            
            # Run the migration
            upgrade(directory=os.path.join(os.path.dirname(__file__), 'migrations'))
            
            print("✓ Migration applied successfully!")
            return True
            
    except Exception as e:
        print(f"❌ Error applying migration: {str(e)}")
        return False

if __name__ == "__main__":
    apply_migration()
