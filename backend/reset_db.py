import os
import sys
from app import app
from models import QRCode, Scan
from extensions import db

def reset_database():
    db_path = os.path.join(app.instance_path, 'qrcodes.db')
    backup_path = os.path.join(app.instance_path, 'qrcodes.db.backup')
    
    print(f"Resetting database at: {db_path}")
    
    # Create instance directory if it doesn't exist
    os.makedirs(app.instance_path, exist_ok=True)
    
    # Backup existing database if it exists
    if os.path.exists(db_path):
        print(f"Backing up existing database to: {backup_path}")
        if os.path.exists(backup_path):
            os.remove(backup_path)
        os.rename(db_path, backup_path)
    
    with app.app_context():
        # Drop all tables
        print("Dropping all tables...")
        db.drop_all()
        
        # Create all tables
        print("Creating tables...")
        db.create_all()
        
        # Verify the schema
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        print(f"Created tables: {tables}")
        
        if 'scans' in tables:
            columns = [c['name'] for c in inspector.get_columns('scans')]
            print(f"Scans table columns: {columns}")
        
        print("Database has been reset with the latest schema.")
        print("You may want to restore your data from the backup if needed.")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Reset the database')
    parser.add_argument('--force', action='store_true', help='Skip confirmation prompt')
    args = parser.parse_args()
    
    if args.force:
        reset_database()
    else:
        print("WARNING: This will delete all data in the database!")
        confirm = input("Are you sure you want to continue? (y/n): ")
        if confirm.lower() == 'y':
            reset_database()
        else:
            print("Database reset cancelled.")
            sys.exit(0)
