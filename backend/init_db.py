from app import create_app
from models import db, User
import os

def init_database():
    app = create_app()
    
    with app.app_context():
        # Create all tables
        print("Creating database tables...")
        db.create_all()
        
        # Check if admin user already exists
        admin_email = "jholman@accelanalysis.com"
        admin = User.query.filter_by(email=admin_email).first()
        
        if not admin:
            # Create admin user
            print("Creating admin user...")
            admin = User(
                email=admin_email,
                is_admin=True
            )
            admin.set_password("Missions1!")  # Hash the password
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
    # Remove existing database
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'qrcodes.db')
    if os.path.exists(db_path):
        print(f"Removing existing database: {db_path}")
        os.remove(db_path)
    
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    # Initialize database
    init_database()
