import os
from app import create_app
from extensions import db
from models import QRCode

def add_user_id_column():
    app = create_app()
    
    with app.app_context():
        # Check if the column already exists
        inspector = db.inspect(db.engine)
        columns = [column['name'] for column in inspector.get_columns('qrcodes')]
        
        if 'user_id' in columns:
            print("user_id column already exists in qrcodes table")
            return
            
        print("Adding user_id column to qrcodes table...")
        
        try:
            # Add the column with a default value of 1 (admin user)
            db.engine.execute('ALTER TABLE qrcodes ADD COLUMN user_id INTEGER DEFAULT 1')
            
            # If there's a foreign key constraint, add it
            db.engine.execute('''
                ALTER TABLE qrcodes 
                ADD CONSTRAINT fk_qrcodes_user_id 
                FOREIGN KEY (user_id) 
                REFERENCES users(id)
            ''')
            
            print("✓ Successfully added user_id column to qrcodes table")
            
        except Exception as e:
            print(f"Error adding user_id column: {str(e)}")
            print("Please check if the column already exists or if there are other issues with the database.")

if __name__ == "__main__":
    add_user_id_column()
