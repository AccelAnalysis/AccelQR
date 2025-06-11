from app import create_app
from models import db, User

def create_test_user():
    app = create_app()
    with app.app_context():
        # Create a new test user
        test_user = User(
            email='test2@example.com',
            is_admin=True
        )
        # Use the new password property
        test_user.password = 'testpass123'
        
        db.session.add(test_user)
        db.session.commit()
        print(f"Created test user: {test_user.email}")
        
        # Verify the user was created
        user = User.query.filter_by(email='test2@example.com').first()
        print(f"User in database: {user.email}, is_admin: {user.is_admin}")
        print(f"Password hash: {user.password_hash}")
        
        # Test password verification
        print(f"Password check result: {user.check_password('testpass123')}")
        print(f"Wrong password check: {user.check_password('wrongpass')}")

if __name__ == '__main__':
    create_test_user()
