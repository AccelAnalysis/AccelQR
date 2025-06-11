from app import create_app
from models import db, User

def create_admin():
    app = create_app()
    
    with app.app_context():
        # Create database tables
        db.create_all()
        
        # Check if admin already exists
        admin = User.query.filter_by(is_admin=True).first()
        if admin:
            print(f"Admin user already exists: {admin.email}")
            return
        
        # Create admin user
        print("\n=== Create Admin User ===")
        email = input("Enter admin email: ")
        password = input("Enter admin password: ")
        
        admin = User(email=email, is_admin=True)
        admin.set_password(password)
        
        db.session.add(admin)
        db.session.commit()
        
        print(f"\n✅ Admin user created successfully!")
        print(f"Email: {email}")
        print("\nYou can now log in to the application with these credentials.")

if __name__ == "__main__":
    create_admin()
