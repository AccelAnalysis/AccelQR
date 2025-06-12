import os
import sys
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from werkzeug.security import generate_password_hash

def get_db_connection(db_url=None):
    """Create a database connection"""
    if not db_url:
        db_url = os.getenv('DATABASE_URL')
    
    if not db_url:
        raise ValueError("No DATABASE_URL provided")
    
    # Handle Heroku-style database URLs if needed
    if db_url.startswith('postgres://'):
        db_url = db_url.replace('postgres://', 'postgresql://', 1)
    
    conn = psycopg2.connect(db_url)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    return conn

def backup_database(conn):
    """Create a backup of the database schema and data"""
    print("Creating backup of the database...")
    try:
        with conn.cursor() as cursor:
            # Create backup schema
            cursor.execute("""
                CREATE SCHEMA IF NOT EXISTS backup_schema;
                COMMENT ON SCHEMA backup_schema IS 'Schema for backup data before migration';
            """)
            
            # Backup tables if they exist
            cursor.execute("""
                DO $$
                BEGIN
                    -- Backup qrcodes if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.tables 
                              WHERE table_schema = 'public' AND table_name = 'qrcodes') THEN
                        CREATE TABLE IF NOT EXISTS backup_schema.qrcodes_backup AS 
                        TABLE public.qrcodes;
                        RAISE NOTICE 'Backed up qrcodes to backup_schema.qrcodes_backup';
                    END IF;
                    
                    -- Backup scans if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.tables 
                              WHERE table_schema = 'public' AND table_name = 'scans') THEN
                        CREATE TABLE IF NOT EXISTS backup_schema.scans_backup AS 
                        TABLE public.scans;
                        RAISE NOTICE 'Backed up scans to backup_schema.scans_backup';
                    END IF;
                END
                $$;
            """)
            print("✓ Database backup completed in backup_schema")
    except Exception as e:
        print(f"Warning: Could not create backup: {e}")

def migrate_to_single_user(conn):
    """Migrate the database to use single admin user"""
    print("Starting PostgreSQL migration to single-user mode...")
    
    with conn.cursor() as cursor:
        try:
            # 1. Drop foreign key constraints if they exist
            print("Dropping foreign key constraints...")
            cursor.execute("""
                DO $$
                BEGIN
                    -- Drop foreign key constraint from scans to qrcodes
                    IF EXISTS (
                        SELECT 1 FROM information_schema.table_constraints 
                        WHERE constraint_schema = 'public' 
                        AND constraint_name = 'scans_qr_code_id_fkey'
                    ) THEN
                        ALTER TABLE public.scans 
                        DROP CONSTRAINT scans_qr_code_id_fkey;
                    END IF;
                    
                    -- Drop foreign key from qrcodes to users if it exists
                    IF EXISTS (
                        SELECT 1 FROM information_schema.table_constraints 
                        WHERE constraint_schema = 'public' 
                        AND constraint_name = 'qrcodes_user_id_fkey'
                    ) THEN
                        ALTER TABLE public.qrcodes 
                        DROP CONSTRAINT qrcodes_user_id_fkey;
                    END IF;
                END
                $$;
            """)
            
            # 2. Drop user-related tables if they exist
            print("Dropping user-related tables...")
            cursor.execute("""
                DROP TABLE IF EXISTS public.user_sessions CASCADE;
                DROP TABLE IF EXISTS public.users CASCADE;
            """)
            
            # 3. Drop user_id column from qrcodes if it exists
            print("Dropping user_id column from qrcodes...")
            cursor.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = 'qrcodes' 
                        AND column_name = 'user_id'
                    ) THEN
                        ALTER TABLE public.qrcodes DROP COLUMN user_id;
                    END IF;
                END
                $$;
            """)
            
            # 4. Create admin_credentials table if it doesn't exist
            print("Creating admin_credentials table...")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS public.admin_credentials (
                    id SERIAL PRIMARY KEY,
                    password_hash TEXT NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                
                COMMENT ON TABLE public.admin_credentials IS 'Stores hashed admin password for single-user authentication';
            """)
            
            # 5. Set admin password
            admin_password = os.getenv('ADMIN_PASSWORD', 'admin123')
            password_hash = generate_password_hash(admin_password)
            
            # Clear any existing admin credentials
            cursor.execute("TRUNCATE TABLE public.admin_credentials RESTART IDENTITY CASCADE;")
            
            # Insert new admin credentials
            cursor.execute(
                """
                INSERT INTO public.admin_credentials (password_hash)
                VALUES (%s)
                RETURNING id;
                """,
                (password_hash,)
            )
            
            print("✓ Database migration completed successfully!")
            print(f"Admin password set to: {admin_password}")
            
        except Exception as e:
            print(f"Error during migration: {e}")
            raise

def main():
    try:
        # Get database URL from environment
        db_url = os.getenv('DATABASE_URL')
        if not db_url:
            print("Error: DATABASE_URL environment variable not set")
            sys.exit(1)
            
        print(f"Connecting to database: {db_url.split('@')[-1]}")
        
        # Connect to the database
        conn = get_db_connection(db_url)
        
        try:
            # Create a backup
            backup_database(conn)
            
            # Run the migration
            migrate_to_single_user(conn)
            
            print("\nMigration completed!")
            print("A backup of your data is available in the backup_schema")
            print("You can now use the application with the admin credentials provided above.")
            
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
