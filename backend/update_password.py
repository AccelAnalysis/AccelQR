from app import create_app
from models import db, User

def update_admin_password():
    app = create_app()
    with app.app_context():
        # Find the admin user
        admin = User.query.filter_by(email='admin@example.com').first()
        if admin:
            print(f"Updating password for {admin.email}")
            admin.set_password('admin')
            db.session.commit()
            print("Password updated successfully")
        else:
            print("Admin user not found")

if __name__ == '__main__':
    update_admin_password()
