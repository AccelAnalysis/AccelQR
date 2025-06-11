from app import create_app
from models import db, User

def check_tables():
    app = create_app()
    with app.app_context():
        # Check if users table exists
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        print("\n=== Database Tables ===")
        print(inspector.get_table_names())
        
        # Check if admin user exists
        admin = User.query.filter_by(is_admin=True).first()
        if admin:
            print("\n=== Admin User ===")
            print(f"ID: {admin.id}")
            print(f"Email: {admin.email}")
            print(f"Is Admin: {admin.is_admin}")
        else:
            print("\nNo admin user found!")

if __name__ == '__main__':
    check_tables()
