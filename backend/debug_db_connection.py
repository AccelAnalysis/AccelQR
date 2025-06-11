from app import create_app
from models import db, User
from sqlalchemy import text, inspect
import os
from sqlalchemy.exc import SQLAlchemyError

def debug_database():
    try:
        app = create_app()
        
        with app.app_context():
            # Get database configuration
            db_uri = app.config.get('SQLALCHEMY_DATABASE_URI', 'Not set')
            
            print("\n=== Database Configuration ===")
            print(f"SQLALCHEMY_DATABASE_URI: {db_uri}")
            print(f"Database Engine: {db.engine}")
            
            # Try to connect to the database
            print("\n=== Database Connection Test ===")
            try:
                with db.engine.connect() as conn:
                    print("✓ Successfully connected to the database")
                    
                    # Get database version
                    db_version = conn.execute(text("SELECT version();")).scalar()
                    print(f"\n=== Database Version ===\n{db_version}")
                    
                    # List all tables using SQLAlchemy inspector
                    print("\n=== Database Tables ===")
                    inspector = inspect(db.engine)
                    tables = inspector.get_table_names()
                    print(f"Found {len(tables)} tables: {', '.join(tables) if tables else 'None'}")
                    
                    if 'users' in tables:
                        print("\n=== Users Table Schema ===")
                        columns = inspector.get_columns('users')
                        for column in columns:
                            print(f"- {column['name']}: {column['type']}")
                        
                        # Get user count
                        user_count = conn.execute(text("SELECT COUNT(*) FROM users;")).scalar()
                        print(f"\nTotal users: {user_count}")
                        
                        # Get admin users
                        print("\n=== Admin Users ===")
                        admins = conn.execute(text("SELECT id, email, created_at FROM users WHERE is_admin = true;"))
                        for admin in admins:
                            print(f"ID: {admin[0]}, Email: {admin[1]}, Created: {admin[2]}")
                    
            except SQLAlchemyError as e:
                print(f"\n❌ Error querying database: {e}")
                raise
                
    except Exception as e:
        print(f"\n❌ Error initializing application: {e}")
        raise

if __name__ == "__main__":
    debug_database()
