from app import create_app
from models import db, User
from sqlalchemy import text
import os

def debug_database():
    app = create_app()
    
    with app.app_context():
        # Get database URI
        db_uri = app.config.get('SQLALCHEMY_DATABASE_URI')
        db_path = app.config.get('DATABASE_PATH')
        
        print("\n=== Database Configuration ===")
        print(f"SQLALCHEMY_DATABASE_URI: {db_uri}")
        print(f"DATABASE_PATH: {db_path}")
        
        # Check if database file exists
        db_exists = os.path.exists(db_path) if db_path else False
        print(f"\n=== Database File ===")
        print(f"Exists: {db_exists}")
        if db_exists:
            print(f"Size: {os.path.getsize(db_path)} bytes")
        
        # Try to connect to the database
        print("\n=== Database Connection Test ===")
        try:
            with db.engine.connect() as conn:
                print("Successfully connected to the database")
                
                # List all tables
                print("\n=== Database Tables ===")
                result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table';"))
                tables = [row[0] for row in result]
                print("Tables:", tables)
                
                if 'users' in tables:
                    print("\n=== Users Table Contents ===")
                    users = conn.execute(text("SELECT * FROM users;"))
                    for user in users:
                        print(f"ID: {user[0]}, Email: {user[1]}, Is Admin: {user[3]}")
                
        except Exception as e:
            print(f"Error connecting to database: {e}")

if __name__ == "__main__":
    debug_database()
