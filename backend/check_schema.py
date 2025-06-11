from app import create_app
from models import db
from sqlalchemy import inspect

def check_schema():
    app = create_app()
    with app.app_context():
        # Check if the user_id column exists in the qrcodes table
        inspector = inspect(db.engine)
        columns = [column['name'] for column in inspector.get_columns('qrcodes')]
        print("Columns in qrcodes table:", columns)
        
        # Check foreign key constraints
        if 'user_id' in columns:
            print("\nForeign keys in qrcodes table:")
            for fk in inspector.get_foreign_keys('qrcodes'):
                print(f"- {fk['constrained_columns']} references {fk['referred_table']}.{fk['referred_columns']}")
        
        # Check indexes
        print("\nIndexes on qrcodes table:")
        for index in inspector.get_indexes('qrcodes'):
            print(f"- {index['name']}: {index['column_names']} (unique: {index.get('unique', False)})")

if __name__ == '__main__':
    check_schema()
