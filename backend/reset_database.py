import os
from app import app, db, QRCode, Scan

def reset_database():
    with app.app_context():
        # Drop all tables
        db.drop_all()
        
        # Create all tables
        db.create_all()
        
        print("Database reset successfully!")

if __name__ == "__main__":
    reset_database()
