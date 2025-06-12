import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text
from werkzeug.security import generate_password_hash

# Add the backend directory to the path
sys.path.append(str(Path(__file__).parent.parent))

# Get database URL from environment variable or use default
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///qrcodes.db')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'admin123')

def run_migration():
    print(f"Connecting to database: {DATABASE_URL}")
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as connection:
        # Start transaction
        trans = connection.begin()
        
        try:
            print("Starting database migration to single-user mode...")
            
            # 1. Drop foreign key constraints that reference users table
            print("Dropping foreign key constraints...")
            try:
                connection.execute(text("""
                    ALTER TABLE qrcodes 
                    DROP CONSTRAINT IF EXISTS fk_qrcodes_user_id
                
                
                """))
                connection.commit()
            except Exception as e:
                print(f"Warning: Could not drop foreign key constraint: {e}")
            
            # 2. Drop user-related tables if they exist
            print("Dropping user-related tables...")
            connection.execute(text("""
                DROP TABLE IF EXISTS user_sessions CASCADE;
                DROP TABLE IF EXISTS users CASCADE;
            
            
            """))
            connection.commit()
            
            # 3. Drop user_id column from qrcodes if it exists
            print("Dropping user_id column from qrcodes...")
            try:
                connection.execute(text("""
                    ALTER TABLE qrcodes 
                    DROP COLUMN IF EXISTS user_id
                
                
                """))
                connection.commit()
            except Exception as e:
                print(f"Warning: Could not drop user_id column: {e}")
            
            # 4. Create a new table for admin credentials if it doesn't exist
            print("Creating admin_credentials table...")
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS admin_credentials (
                    id SERIAL PRIMARY KEY,
                    password_hash TEXT NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            
            
            """))
            connection.commit()
            
            # 5. Clear any existing admin credentials and set new password
            print("Setting admin password...")
            password_hash = generate_password_hash(ADMIN_PASSWORD)
            
            # Delete any existing admin credentials
            connection.execute(text("DELETE FROM admin_credentials"))
            
            # Insert new admin credentials
            connection.execute(
                text("INSERT INTO admin_credentials (password_hash) VALUES (:hash)"),
                {"hash": password_hash}
            )
            
            # Commit transaction
            trans.commit()
            print("✓ Database migration completed successfully!")
            print(f"Admin password set to: {ADMIN_PASSWORD}")
            
        except Exception as e:
            trans.rollback()
            print(f"Error during migration: {e}")
            raise

if __name__ == "__main__":
    run_migration()
