import os
import sys
from app import create_app
from models import db
from sqlalchemy import text

def add_user_id_column():
    # Create app
    app = create_app()
    
    with app.app_context():
        try:
            # Check if the column already exists
            inspector = db.inspect(db.engine)
            columns = [column['name'] for column in inspector.get_columns('qrcodes')]
            
            if 'user_id' in columns:
                print("✓ user_id column already exists in qrcodes table")
                return True
                
            # Add the user_id column
            print("Adding user_id column to qrcodes table...")
            
            # First, add the column as nullable
            db.session.execute(text("""
                ALTER TABLE qrcodes 
                ADD COLUMN user_id INTEGER;
            
                -- Add foreign key constraint
                ALTER TABLE qrcodes 
                ADD CONSTRAINT fk_qrcodes_user_id 
                FOREIGN KEY (user_id) 
                REFERENCES users(id);
            
                -- Update existing records to have user_id = 1 (admin)
                UPDATE qrcodes 
                SET user_id = (SELECT id FROM users WHERE is_admin = true LIMIT 1);
                
                -- Now make the column non-nullable
                ALTER TABLE qrcodes 
                ALTER COLUMN user_id SET NOT NULL;
            
                -- Create index on user_id for better performance
                CREATE INDEX idx_qrcodes_user_id ON qrcodes(user_id);
            
            """))
            
            db.session.commit()
            print("✓ Successfully added user_id column to qrcodes table")
            return True
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error adding user_id column: {str(e)}")
            return False

if __name__ == '__main__':
    success = add_user_id_column()
    sys.exit(0 if success else 1)
