import os
from app import create_app
from models import db, User, QRCode, Scan
from werkzeug.security import generate_password_hash

def reset_database():
    # Create the Flask application
    app = create_app()
    
    with app.app_context():
        # Drop all tables
        print("Dropping all tables...")
        db.drop_all()
        
        # Create all tables
        print("Creating all tables...")
        db.create_all()
        
        # Create admin user
        admin_email = os.getenv('ADMIN_EMAIL', 'admin@example.com')
        admin_password = os.getenv('ADMIN_PASSWORD', 'admin123')
        
        print(f"Creating admin user: {admin_email}")
        admin = User(
            email=admin_email,
            is_admin=True
        )
        admin.password_hash = generate_password_hash(admin_password)
        db.session.add(admin)
        db.session.commit()
        
        # Refresh the admin user to get the ID
        admin = User.query.filter_by(email=admin_email).first()
        
        # Create a sample QR code
        print("Creating sample QR code...")
        sample_qr = QRCode(
            name="Sample QR Code",
            target_url="https://example.com",
            short_code="sample123"
        )
        db.session.add(sample_qr)
        db.session.commit()
        
        print("\nDatabase reset successfully!")
        print(f"Admin user created with email: {admin_email}")
        print(f"Sample QR code created with short code: sample123")

if __name__ == "__main__":
    reset_database()
