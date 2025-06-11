from app import create_app
from models import db, User

def create_test_user():
    app = create_app()
    with app.app_context():
        # Create a new test user
        test_user = User(
            email='test@example.com',
            is_admin=True
        )
        test_user.set_password('testpassword123')
        
        db.session.add(test_user)
        db.session.commit()
        print(f"Created test user: {test_user.email}")

if __name__ == '__main__':
    create_test_user()
