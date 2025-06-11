from app import create_app
from models import db, User
from sqlalchemy import inspect, text

def check_database():
    app = create_app()
    with app.app_context():
        inspector = inspect(db.engine)
        
        # Get all table names
        tables = inspector.get_table_names()
        print("\n=== Database Tables ===")
        for table in tables:
            print(f"\nTable: {table}")
            print("Columns:")
            # Get column info for each table
            columns = inspector.get_columns(table)
            for column in columns:
                print(f"  - {column['name']}: {column['type']}")
        
        # Check if admin user exists
        admin = User.query.filter_by(is_admin=True).first()
        if admin:
            print("\n=== Admin User ===")
            print(f"Email: {admin.email}")
            print(f"Is Admin: {admin.is_admin}")
            print(f"Created At: {admin.created_at}")
        else:
            print("\nNo admin user found!")

if __name__ == '__main__':
    check_database()
