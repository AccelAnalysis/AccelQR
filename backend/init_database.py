from app import create_app
from models import db, User

def init_database():
    # Create the Flask app
    app = create_app()
    
    # Create database tables
    with app.app_context():
        print("Dropping all tables...")
        db.drop_all()
        print("Creating all tables...")
        db.create_all()
        print("Database initialized successfully!")

if __name__ == '__main__':
    init_database()
