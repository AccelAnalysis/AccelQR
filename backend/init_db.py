from app import create_app
from models import User, db
from extensions import db as ext_db
import os
import sys
from sqlalchemy.exc import SQLAlchemyError
from flask_migrate import upgrade, stamp
from sqlalchemy import inspect

def init_db():
    try:
        app = create_app()
        with app.app_context():
            migrations_dir = os.path.join(os.path.dirname(__file__), 'migrations')

            print("Initializing database...")
            
            # Create all tables
            print("Creating database tables...")
            ext_db.create_all()
            print("✓ Database tables created")

            # Apply migrations (needed for schema updates like new columns)
            inspector = inspect(db.engine)
            tables = inspector.get_table_names()
            if 'alembic_version' in tables:
                print("Applying database migrations...")
                upgrade(directory=migrations_dir)
                print("✓ Database migrations applied successfully!")
            else:
                # Database was created without Alembic tracking; mark it as up-to-date
                stamp(directory=migrations_dir, revision='head')

            # Get admin credentials from environment variables
            admin_email = os.getenv('ADMIN_EMAIL', 'admin@example.com')
            flask_env = os.getenv('FLASK_ENV', '').lower()
            is_production = flask_env == 'production' or (not flask_env and os.getenv('RENDER') is not None)
            admin_password = os.getenv('ADMIN_PASSWORD')
            if not admin_password:
                if is_production:
                    raise RuntimeError("ADMIN_PASSWORD must be set in production")
                admin_password = 'admin123'
            
            # Check if admin user exists
            admin = User.query.filter_by(email=admin_email).first()
            
            if not admin:
                # Create admin user
                print(f"Creating admin user: {admin_email}")
                try:
                    admin = User(
                        email=admin_email,
                        is_admin=True
                    )
                    admin.set_password(admin_password)
                    db.session.add(admin)
                    db.session.commit()
                    print("✓ Admin user created successfully!")
                except SQLAlchemyError as e:
                    db.session.rollback()
                    print(f"Error creating admin user: {str(e)}")
                    raise
            else:
                print("ℹ️ Admin user already exists.")
                # Update password if it's the default one
                if admin.check_password('admin123'):
                    admin.set_password(admin_password)
                    db.session.commit()
                    print("✓ Admin password updated")
            
            # Verify database schema
            print("\nVerifying database schema...")
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
