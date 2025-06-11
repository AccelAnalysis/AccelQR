from app import create_app
from models import db
import os
import sys

def debug_database():
    # Create the Flask app
    app = create_app()
    
    with app.app_context():
        # Print database URI
        print(f"Database URI: {app.config['SQLALCHEMY_DATABASE_URI']}")
        
        # Get absolute path to the database
        db_path = os.path.join(os.path.dirname(__file__), 'instance/qrcodes.db')
        print(f"Database path: {db_path}")
        print(f"Database file exists: {os.path.exists(db_path)}")
        
        # Get database tables
        from sqlalchemy import inspect, text
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        print(f"\nDatabase tables: {tables}")
        
        # If users table exists, print its contents
        if 'users' in tables:
            print("\nUsers table schema:")
            columns = inspector.get_columns('users')
            for column in columns:
                print(f"- {column['name']}: {column['type']}")
            
            try:
                # Print user count
                result = db.session.execute(text('SELECT COUNT(*) FROM users'))
                count = result.scalar()
                print(f"\nNumber of users: {count}")
                
                # Print first few users
                if count > 0:
                    print("\nFirst user:")
                    result = db.session.execute(text('SELECT * FROM users LIMIT 1'))
                    user = result.fetchone()
                    print(user)
            except Exception as e:
                print(f"\nError querying users table: {e}")
        else:
            print("\nUsers table does not exist in the database.")
            
        # Print current working directory and list files in instance directory
        print("\nCurrent working directory:", os.getcwd())
        print("\nContents of instance directory:")
        instance_dir = os.path.join(os.path.dirname(__file__), 'instance')
        if os.path.exists(instance_dir):
            for f in os.listdir(instance_dir):
                print(f"- {f} (size: {os.path.getsize(os.path.join(instance_dir, f))} bytes)")

if __name__ == '__main__':
    debug_database()
