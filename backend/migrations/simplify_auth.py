import os
import sys
from pathlib import Path

# Add the backend directory to the path
sys.path.append(str(Path(__file__).parent.parent))

from app import create_app
from extensions import db
from werkzeug.security import generate_password_hash

def migrate_to_single_user():
    """
    Migrate the database to use a single admin user with password authentication.
    This script will:
    1. Keep all existing QR codes and scans
    2. Remove user-related tables and columns
    3. Set up a simple password-based authentication
    """
    app = create_app()
    
    with app.app_context():
        print("Starting database migration to single-user mode...")
        
        # Get database connection
        conn = db.engine.connect()
        
        try:
            # Start transaction
            trans = conn.begin()
            
            # 1. Drop foreign key constraints that reference users table
            print("Dropping foreign key constraints...")
            try:
                conn.execute("""
                    ALTER TABLE qrcodes 
                    DROP CONSTRAINT IF EXISTS fk_qrcodes_user_id
                """)
            except Exception as e:
                print(f"Warning: Could not drop foreign key constraint: {e}")
            
            # 2. Drop user-related tables if they exist
            print("Dropping user-related tables...")
            conn.execute("""
                DROP TABLE IF EXISTS user_sessions CASCADE;
                DROP TABLE IF EXISTS users CASCADE;
            """)
            
            # 3. Drop user_id column from qrcodes if it exists
            print("Dropping user_id column from qrcodes...")
            try:
                conn.execute("""
                    ALTER TABLE qrcodes 
                    DROP COLUMN IF EXISTS user_id
                """)
            except Exception as e:
                print(f"Warning: Could not drop user_id column: {e}")
            
            # 4. Create a new table for admin credentials
            print("Creating admin_credentials table...")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS admin_credentials (
                    id SERIAL PRIMARY KEY,
                    password_hash TEXT NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # 5. Set admin password (default: 'admin123')
            admin_password = os.getenv('ADMIN_PASSWORD', 'admin123')
            password_hash = generate_password_hash(admin_password)
            
            print("Setting admin password...")
            conn.execute(
                "INSERT INTO admin_credentials (password_hash) VALUES (%s)",
                (password_hash,)
            )
            
            # Commit transaction
            trans.commit()
            print("✓ Database migration completed successfully!")
            print(f"Admin password set to: {admin_password}")
            
        except Exception as e:
            trans.rollback()
            print(f"Error during migration: {e}")
            raise

if __name__ == "__main__":
    migrate_to_single_user()
