import os
import sys
from pathlib import Path
import sqlite3
from werkzeug.security import generate_password_hash

def migrate_sqlite(db_path):
    """
    SQLite-specific migration to:
    1. Create a backup of the current database
    2. Create a new database with the updated schema
    3. Copy data from the old database to the new one
    4. Replace the old database with the new one
    """
    # Create backup path
    backup_path = f"{db_path}.backup"
    print(f"Creating backup at {backup_path}")
    
    try:
        # Create backup
        if os.path.exists(db_path):
            with open(db_path, 'rb') as src, open(backup_path, 'wb') as dst:
                dst.write(src.read())
        
        # Connect to the existing database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get list of tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"Found tables: {tables}")
        
        # Create new database in memory
        new_conn = sqlite3.connect(':memory:')
        new_cursor = new_conn.cursor()
        
        # Create new schema
        print("Creating new schema...")
        
        # Create qrcodes table without user_id
        new_cursor.execute("""
        CREATE TABLE IF NOT EXISTS qrcodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            target_url TEXT NOT NULL,
            short_code TEXT UNIQUE NOT NULL,
            folder TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        
        # Create scans table
        new_cursor.execute("""
        CREATE TABLE IF NOT EXISTS scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            qr_code_id INTEGER NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ip_address TEXT,
            user_agent TEXT,
            country TEXT,
            region TEXT,
            city TEXT,
            timezone TEXT,
            device_type TEXT,
            os_family TEXT,
            browser_family TEXT,
            referrer_domain TEXT,
            time_on_page INTEGER,
            scrolled BOOLEAN DEFAULT 0,
            scan_method TEXT,
            FOREIGN KEY (qr_code_id) REFERENCES qrcodes (id)
        )
        """)
        
        # Create admin_credentials table
        new_cursor.execute("""
        CREATE TABLE IF NOT EXISTS admin_credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        
        # Copy data from old tables to new ones
        if 'qrcodes' in tables:
            print("Migrating qrcodes table...")
            cursor.execute("SELECT id, name, target_url, short_code, folder, created_at FROM qrcodes")
            qrcodes = cursor.fetchall()
            new_cursor.executemany(
                "INSERT INTO qrcodes (id, name, target_url, short_code, folder, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                qrcodes
            )
        
        if 'scans' in tables:
            print("Migrating scans table...")
            cursor.execute("SELECT * FROM scans")
            scans = cursor.fetchall()
            new_cursor.executemany(
                """INSERT INTO scans (
                    id, qr_code_id, timestamp, ip_address, user_agent, country, 
                    region, city, timezone, device_type, os_family, browser_family,
                    referrer_domain, time_on_page, scrolled, scan_method
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                [row[:16] for row in scans]  # Only take the first 16 columns if they exist
            )
        
        # Set admin password
        admin_password = os.getenv('ADMIN_PASSWORD', 'admin123')
        password_hash = generate_password_hash(admin_password)
        new_cursor.execute(
            "INSERT INTO admin_credentials (password_hash) VALUES (?)",
            (password_hash,)
        )
        
        # Commit changes to the in-memory database
        new_conn.commit()
        
        # Close the old database connection
        conn.close()
        
        # Replace the old database with the new one
        print("Replacing old database with new schema...")
        new_conn.backup(sqlite3.connect(db_path))
        
        print("✓ Migration completed successfully!")
        print(f"Admin password set to: {admin_password}")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        print(f"A backup was created at: {backup_path}")
        raise

if __name__ == "__main__":
    # Get the database path from environment variable or use default
    db_path = os.getenv('DATABASE_URL', 'sqlite:///qrcodes.db').replace('sqlite:///', '')
    migrate_sqlite(db_path)
