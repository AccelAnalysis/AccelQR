from app import create_app
from models import db, User
from werkzeug.security import generate_password_hash
import os

def init_db():
    app = create_app()
    with app.app_context():
        # Create all tables
        print("Creating database tables...")
        db.create_all()
        print("Database tables created")
        
        # Get admin credentials from environment variables
        admin_email = os.getenv('ADMIN_EMAIL', 'admin@example.com')
        admin_password = os.getenv('ADMIN_PASSWORD', 'admin')  # Change this in production!
        
        # Check if admin user exists
        admin = User.query.filter_by(email=admin_email).first()
        
        if not admin:
            # Create admin user
            print(f"Creating admin user: {admin_email}")
            admin = User(
                email=admin_email,
                password_hash=generate_password_hash(admin_password),
                is_admin=True
            )
            db.session.add(admin)
            db.session.commit()
            print("Admin user created successfully!")
        else:
            print("Admin user already exists.")
        
        print("Database has been initialized with the latest schema.")
        
        # Verify tables were created
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        print("\nDatabase tables:", inspector.get_table_names())
        
        # Verify users table structure
        if 'users' in inspector.get_table_names():
            print("\nUsers table columns:")
            for column in inspector.get_columns('users'):
                print(f"- {column['name']}: {column['type']}")

if __name__ == "__main__":
    init_db()
