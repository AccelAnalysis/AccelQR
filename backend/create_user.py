from app import create_app
from models import db, User
from werkzeug.security import generate_password_hash

def create_admin_user():
    app = create_app()
    with app.app_context():
        # Check if admin user already exists
        admin = User.query.filter_by(email='admin@example.com').first()
        if not admin:
            # Create admin user
            admin = User(
                email='admin@example.com',
                is_admin=True
            )
            admin.set_password('admin')
            db.session.add(admin)
            db.session.commit()
            print("Admin user created successfully!")
        else:
            print("Admin user already exists.")
        
        # List all users
        users = User.query.all()
        print("\nCurrent users in the database:")
        for user in users:
            print(f"- {user.email} (admin: {user.is_admin})")

if __name__ == '__main__':
    create_admin_user()
