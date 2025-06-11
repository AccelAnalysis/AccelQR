from app import create_app
from models import User

def check_admin_password():
    app = create_app()
    with app.app_context():
        # Get the admin user
        admin = User.query.filter_by(email='admin@example.com').first()
        if not admin:
            print("Admin user not found")
            return
            
        print(f"Admin user found: {admin.email}")
        print(f"Password hash: {admin.password_hash}")
        
        # Test password verification
        print("\nTesting password verification:")
        for password in ['admin', 'password', 'Missions1!']:
            is_valid = admin.check_password(password)
            print(f"Password '{password}': {'Valid' if is_valid else 'Invalid'}")

if __name__ == '__main__':
    check_admin_password()
