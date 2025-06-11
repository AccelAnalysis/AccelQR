from app import create_app
from models import db, User
from werkzeug.security import generate_password_hash
import os
import sys
from sqlalchemy.exc import SQLAlchemyError

def init_db():
    try:
        app = create_app()
        with app.app_context():
            print("Initializing database...")
            
            # Create all tables
            print("Creating database tables...")
            db.create_all()
            print("✓ Database tables created")
            
            # Get admin credentials from environment variables
            admin_email = os.getenv('ADMIN_EMAIL')
            admin_password = os.getenv('ADMIN_PASSWORD')
            
            if not admin_email or not admin_password:
                raise ValueError("ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be set")
            
            # Check if admin user exists
            admin = User.query.filter_by(email=admin_email).first()
            
            if not admin:
                # Create admin user
                print(f"Creating admin user: {admin_email}")
                try:
                    admin = User(
                        email=admin_email,
                        password_hash=generate_password_hash(admin_password),
                        is_admin=True
                    )
                    db.session.add(admin)
                    db.session.commit()
                    print("✓ Admin user created successfully!")
                except SQLAlchemyError as e:
                    db.session.rollback()
                    print(f"Error creating admin user: {str(e)}")
                    raise
            else:
                print("ℹ️ Admin user already exists.")
            
            # Verify database schema
            print("\nVerifying database schema...")
            from sqlalchemy import inspect
            inspector = inspect(db.engine)
            tables = inspector.get_table_names()
            print(f"Found {len(tables)} tables: {', '.join(tables)}")
            
            if 'users' in tables:
                print("\nUsers table columns:")
                for column in inspector.get_columns('users'):
                    print(f"- {column['name']}: {column['type']}")
            
            print("\n✓ Database initialization completed successfully!")
            return True
            
    except Exception as e:
        print(f"\n❌ Error initializing database: {str(e)}", file=sys.stderr)
        if 'db' in locals():
            db.session.rollback()
        return False

if __name__ == "__main__":
    success = init_db()
    sys.exit(0 if success else 1)
