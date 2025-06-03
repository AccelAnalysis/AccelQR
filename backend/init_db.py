from app import app, db
import os

def init_database():
    with app.app_context():
        # Create all tables
        db.create_all()
        
        print("Database has been initialized with the latest schema.")

if __name__ == "__main__":
    init_database()
